const express = require('express');

const { authenticate } = require('../middlewares/authMiddleware');
const { requireVerifiedDoctor } = require('../middlewares/roleMiddleware');
const clinicsController = require('../controllers/clinicsController');

const router = express.Router();

router.use(authenticate);

router.post('/', requireVerifiedDoctor, clinicsController.addClinicData);
router.get('/', requireVerifiedDoctor, clinicsController.getAllClinics);
router.get('/:id', requireVerifiedDoctor, clinicsController.getSingleClinic);
router.put('/:id', requireVerifiedDoctor, clinicsController.updateClinic);
router.delete('/:id', requireVerifiedDoctor, clinicsController.deleteClinic);

module.exports = router;
