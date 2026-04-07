const express = require('express');

const { authenticate } = require('../middlewares/authMiddleware');
const { requireRole, requireVerifiedDoctor } = require('../middlewares/roleMiddleware');
const doctorController = require('../controllers/doctorController');
const allergyController = require('../controllers/allergyController');
const conditionController = require('../controllers/conditionController');
const emergencyController = require('../controllers/emergencyController');

const router = express.Router();


router.use(authenticate);

router.get('/', requireRole('doctor'), doctorController.getOwnProfile);
router.post('/', requireRole('doctor'), doctorController.createDoctorProfile);
router.put('/', requireRole('doctor'), doctorController.updateOwnProfile);
router.get('/consultations', requireVerifiedDoctor, doctorController.getOwnConsultations);
router.get('/:id', doctorController.getDoctorById);



//patient allergies 
// router.get('/patients/:patientId/allergies', requireVerifiedDoctor, allergyController.getPatientAllergy);

//patient chronic condition
// router.get('/patients/:patientId/chronic-conditions', requireVerifiedDoctor, conditionController.getPatientConditions);

//patient emergency info
// router.get('/patients/:patientId/emergency-info', requireVerifiedDoctor, emergencyController.getPatientEmergencyInfo);

//emergency data for patient
router.get('/emergency/:patientId/:clinicId', requireVerifiedDoctor, doctorController.getPatientDataDuringEmergency);

module.exports = router;
