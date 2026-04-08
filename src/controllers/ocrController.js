const fs = require('fs');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const ocrManager = require('../utils/ocrManager');
const PrescriptionService = require('../services/prescriptionService');

/**
 * Main OCR scan endpoint
 * Handles file upload and delegates to persistent OCR worker
 */
const ocrScan = async (req, res, next) => {
    if (!req.file) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', 'No file uploaded');
    }

    // Extract IDs from request body
    const { consultation_id, patient_id, doctor_id } = req.body;

    const filePath = req.file.path;
    const checkpoints = [];
    let prescriptionData = null;

    try {
        const status = ocrManager.getStatus();
        if (!status.isReady) {
            fs.unlink(filePath, (err) => {
                if (err) console.error('Error deleting temporary file:', err);
            });

            return errorResponse(
                res,
                503,
                'OCR_NOT_READY',
                'OCR service is initializing. Please retry in a few moments.',
                { status }
            );
        }

        console.log('[OCR_SCAN] Processing file:', filePath);

        const result = await ocrManager.processRequest(
            filePath,
            (checkpoint) => {
                checkpoints.push(checkpoint);
                console.log(`[OCR_SCAN] Checkpoint: ${checkpoint.checkpoint} - ${checkpoint.status}`);
            }
        );

        prescriptionData = result.prescription;

        fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting temporary file:', err);
        });

        // ── Save to Database ──────────────────────────────────────────────────
        let prescriptionId = null;

        try {
            prescriptionId = await PrescriptionService.savePrescription(
                prescriptionData,
                consultation_id,
                patient_id,
                doctor_id
            );
            console.log('[OCR_SCAN] Prescription saved successfully with ID:', prescriptionId);

        } catch (dbErr) {
            console.error('[OCR_SCAN_DB_ERROR]', dbErr.message);

            return errorResponse(
                res,
                500,
                'DATABASE_ERROR',
                'Failed to save prescription to database',
                {
                    checkpoints: checkpoints,
                    error: dbErr.message
                }
            );
        }

        // Return success with prescription ID
        return successResponse(
            res,
            200,
            {
                prescription_id: prescriptionId,
                drugs_count: prescriptionData.drugs ? prescriptionData.drugs.length : 0,
                success: true
            },
            'Prescription saved successfully'
        );

    } catch (err) {
        console.error('[OCR_SCAN_ERROR]', err.message);

        // Cleanup file on error
        fs.unlink(filePath, (cleanupErr) => {
            if (cleanupErr) console.error('Error cleaning up file:', cleanupErr);
        });

        return errorResponse(
            res,
            500,
            'OCR_PROCESSING_ERROR',
            err.message,
            {
                checkpoints: checkpoints,
                error: err.message
            }
        );
    }
};

const ocrHealth = (req, res, next) => {
    const status = ocrManager.getStatus();

    if (status.isReady) {
        return successResponse(
            res,
            200,
            {
                status: 'healthy',
                ready: true,
                pendingRequests: status.pendingRequests
            },
            'OCR service is healthy'
        );
    } else {
        return successResponse(
            res,
            202,
            {
                status: 'initializing',
                ready: false,
                initializing: status.isInitializing
            },
            'OCR service is initializing'
        );
    }
};

module.exports = { ocrScan, ocrHealth };
