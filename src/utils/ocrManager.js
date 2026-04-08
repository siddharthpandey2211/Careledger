/**
 * OCR Manager - Manages the persistent Python OCR worker process
 * 
 * Responsibilities:
 * - Spawn persistent Python worker at startup
 * - Queue requests and send to worker
 * - Stream checkpoints to requests
 * - Handle worker lifecycle and errors
 * 
 * Usage:
 *   const ocrManager = require('./ocrManager');
 *   await ocrManager.initialize();  // Blocks until OCR ready
 *   const result = await ocrManager.processRequest(imagePath, onCheckpoint);
 */

const child_process = require('child_process');
const path = require('path');
const { getPythonCommand } = require('./pythonHelper');

/**
 * Generate a simple UUID-like string
 */
function generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

class OCRManager {
    constructor() {
        this.worker = null;
        this.isReady = false;
        this.requestHandlers = new Map(); // Map<requestId, {resolve, reject, checkpoints}>
        this.isInitializing = false;
    }

    /**
     * Initialize the persistent worker
     * Blocks until OCR is ready
     */
    async initialize() {
        if (this.isInitializing) {
            return new Promise((resolve, reject) => {
                const checkReady = setInterval(() => {
                    if (this.isReady) {
                        clearInterval(checkReady);
                        resolve();
                    }
                }, 100);
                setTimeout(() => clearInterval(checkReady), 120000); // 2 min timeout
            });
        }

        this.isInitializing = true;

        return new Promise((resolve, reject) => {
            const pythonCmd = getPythonCommand();
            if (!pythonCmd) {
                this.isInitializing = false;
                return reject(new Error('Python not found in PATH'));
            }

            const workerPath = path.resolve(__dirname, '../../OCR_processor/ocr_persistent_worker.py');
            const ocrDir = path.resolve(__dirname, '../../OCR_processor');

            console.log('[OCR_MANAGER] Spawning persistent worker...');

            try {
                this.worker = child_process.spawn(pythonCmd, [workerPath], {
                    cwd: ocrDir,
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                // Handle worker startup errors
                this.worker.on('error', (err) => {
                    this.isInitializing = false;
                    this.isReady = false;
                    console.error('[OCR_MANAGER] Worker spawn error:', err);
                    reject(err);
                });

                // Handle worker exit
                this.worker.on('close', (code) => {
                    console.error(`[OCR_MANAGER] Worker exited with code ${code}`);
                    this.isReady = false;
                    this.worker = null;

                    // Reject all pending requests
                    for (const [requestId, handler] of this.requestHandlers) {
                        handler.reject(new Error('OCR worker terminated unexpectedly'));
                    }
                    this.requestHandlers.clear();
                });

                // Handle stderr for debugging
                this.worker.stderr.on('data', (data) => {
                    const errorMsg = data.toString();
                    console.error(`[OCR_WORKER]`, errorMsg);
                    // Detect critical errors and fail fast
                    if (errorMsg.includes('ModuleNotFoundError') || errorMsg.includes('ImportError')) {
                        this.isInitializing = false;
                        this.isReady = false;
                        this.worker?.kill();
                        reject(new Error(`OCR initialization failed: ${errorMsg.split('\n')[0]}`));
                    }
                });

                // Handle stdout (messages from worker)
                let buffer = '';
                this.worker.stdout.on('data', (data) => {
                    buffer += data.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep incomplete line in buffer

                    for (const line of lines) {
                        if (!line.trim()) continue;

                        try {
                            const message = JSON.parse(line);
                            this._handleWorkerMessage(message, reject);
                        } catch (e) {
                            console.error('[OCR_MANAGER] Failed to parse worker message:', e);
                        }
                    }
                });

                // Set a timeout for initialization
                const initTimeout = setTimeout(() => {
                    if (!this.isReady) {
                        this.isInitializing = false;
                        this.worker?.kill();
                        reject(new Error('OCR worker initialization timeout'));
                    }
                }, 10000); // 10 second timeout

                // Wait for ready status
                const originalTimeout = setTimeout;
                const waitForReady = () => {
                    if (this.isReady) {
                        clearTimeout(initTimeout);
                        this.isInitializing = false;
                        resolve();
                    }
                };
                this._readyResolver = waitForReady;

            } catch (err) {
                this.isInitializing = false;
                reject(err);
            }
        });
    }

    /**
     * Process a single OCR request
     * @param {string} imagePath - Path to image file
     * @param {Function} onCheckpoint - Callback for checkpoint updates
     * @returns {Promise<Object>} - Prescription data
     */
    async processRequest(imagePath, onCheckpoint = null) {
        if (!this.isReady) {
            throw new Error('OCR worker not initialized');
        }

        const requestId = generateRequestId();
        const checkpoints = [];

        return new Promise((resolve, reject) => {
            // Store handler for this request
            this.requestHandlers.set(requestId, {
                resolve,
                reject,
                checkpoints,
                onCheckpoint,
                startTime: Date.now()
            });

            try {
                // Send request to worker
                const request = {
                    image_path: imagePath,
                    request_id: requestId
                };

                console.log(`[OCR_MANAGER] Sending request ${requestId} to worker`);
                this.worker.stdin.write(JSON.stringify(request) + '\n');
            } catch (err) {
                this.requestHandlers.delete(requestId);
                reject(err);
            }

            // Set timeout for request (5 minutes)
            setTimeout(() => {
                if (this.requestHandlers.has(requestId)) {
                    this.requestHandlers.delete(requestId);
                    reject(new Error('OCR request timeout'));
                }
            }, 300000);
        });
    }

    /**
     * Handle messages from worker
     */
    _handleWorkerMessage(message, initReject) {
        const { type } = message;

        if (type === 'status') {
            console.log(`[OCR_MANAGER] Worker status: ${message.status} - ${message.message}`);

            if (message.status === 'ready') {
                this.isReady = true;
                if (this._readyResolver) {
                    this._readyResolver();
                }
            } else if (message.status === 'failed') {
                if (initReject) {
                    initReject(new Error(message.message));
                }
            }
        } else if (type === 'checkpoint') {
            const requestId = message.request_id || 'unknown';
            const handler = this.requestHandlers.get(requestId);

            if (handler) {
                handler.checkpoints.push({
                    checkpoint: message.checkpoint,
                    status: message.status,
                    message: message.message,
                    data: message.data
                });

                // Call checkpoint callback if provided
                if (handler.onCheckpoint) {
                    try {
                        handler.onCheckpoint({
                            checkpoint: message.checkpoint,
                            status: message.status,
                            message: message.message
                        });
                    } catch (e) {
                        console.error('[OCR_MANAGER] Error in checkpoint callback:', e);
                    }
                }

                console.log(`[OCR_MANAGER] Checkpoint ${message.checkpoint}: ${message.status}`);
            }
        } else if (type === 'done') {
            const requestId = message.request_id;
            const handler = this.requestHandlers.get(requestId);

            if (handler) {
                const duration = Date.now() - handler.startTime;
                console.log(`[OCR_MANAGER] Request ${requestId} completed in ${duration}ms`);

                this.requestHandlers.delete(requestId);

                if (message.success) {
                    handler.resolve({
                        checkpoints: handler.checkpoints,
                        prescription: message.prescription,
                        success: true
                    });
                } else {
                    handler.reject(new Error(message.error || 'OCR processing failed'));
                }
            }
        } else if (type === 'error') {
            const requestId = message.request_id;
            const handler = this.requestHandlers.get(requestId);

            if (handler) {
                this.requestHandlers.delete(requestId);
                handler.reject(new Error(message.message));
            }
        }
    }

    /**
     * Gracefully shutdown the worker
     */
    async shutdown() {
        if (this.worker) {
            console.log('[OCR_MANAGER] Shutting down worker...');
            this.worker.kill();
            this.worker = null;
            this.isReady = false;
        }
    }

    /**
     * Get worker status
     */
    getStatus() {
        return {
            isReady: this.isReady,
            isInitializing: this.isInitializing,
            isAlive: this.worker != null,
            pendingRequests: this.requestHandlers.size
        };
    }
}

// Singleton instance
let instance = null;

function getInstance() {
    if (!instance) {
        instance = new OCRManager();
    }
    return instance;
}

module.exports = {
    getInstance,
    initialize: () => getInstance().initialize(),
    processRequest: (imagePath, onCheckpoint) => getInstance().processRequest(imagePath, onCheckpoint),
    getStatus: () => getInstance().getStatus(),
    shutdown: () => getInstance().shutdown()
};
