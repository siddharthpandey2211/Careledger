const express = require('express');

const { authenticate } = require('../middlewares/authMiddleware');
const { requireRole, requireVerifiedDoctor } = require('../middlewares/roleMiddleware');
const consultationController = require('../controllers/consultationController');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('doctor'));
router.use(requireVerifiedDoctor);

router.post('/', consultationController.startConsultation);
router.get('/:consultationId', consultationController.getConsultationById);
router.put('/:consultationId/status', consultationController.updateConsultationStatus);
router.post('/:consultationId/prescription', consultationController.upsertPrescription);
router.get('/:consultationId/prescription', consultationController.getPrescription);

module.exports = router;
