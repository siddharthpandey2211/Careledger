const express = require('express');

const { authenticate } = require('../middlewares/authMiddleware');
const { requireVerifiedDoctor } = require('../middlewares/roleMiddleware');
const activeMedicationController = require('../controllers/activePrescriptionController');

const router = express.Router();
router.get('/:userId', activeMedicationController.getActiveMedicationByUserId);
router.post('/', authenticate, requireVerifiedDoctor, activeMedicationController.addActiveMedication);
router.put('/:id', authenticate, requireVerifiedDoctor, activeMedicationController.updateActiveMedication);
router.delete('/:id', authenticate, requireVerifiedDoctor, activeMedicationController.deleteActiveMedicationById);
module.exports = router;
