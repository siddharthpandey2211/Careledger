require('dotenv').config();

const app = require('./src/app');
const ocrManager = require('./src/utils/ocrManager');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Initialize OCR manager and start server
async function startServer() {
    // Try to initialize OCR with a timeout
    try {
        console.log('[SERVER] Initializing OCR service...');
        const ocrTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('OCR initialization timeout')), 15000)
        );
        await Promise.race([ocrManager.initialize(), ocrTimeout]);
        console.log('[SERVER] ✅ OCR service initialized and ready!');
    } catch (err) {
        console.warn('[SERVER] ⚠️  Warning: OCR service unavailable -', err.message);
        console.warn('[SERVER] Continuing without OCR. Some features may be unavailable.');
    }

    try {
        app.listen(PORT, () => {
            console.log(`[SERVER] 🚀 Server listening on port ${PORT}`);
            console.log(`[SERVER] Frontend available at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('[SERVER] ❌ Failed to start server:', err.message);
        process.exit(1);
    }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('[SERVER] Shutting down gracefully...');
    await ocrManager.shutdown();
    process.exit(0);
});
