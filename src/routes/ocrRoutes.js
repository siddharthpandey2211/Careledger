const express = require('express');
// const { authenticate } = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ocrController = require('../controllers/ocrController');
const { successResponse } = require('../utils/responseFormatter');
const uploadsDir = path.join(__dirname, '../../OCR_processor/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `upload${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only images and PDFs are allowed'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();

router.post(
    '/scan',
    // authenticate,
    upload.single('file'),
    ocrController.ocrScan
);

router.get("/health", ocrController.ocrHealth);

module.exports = router;