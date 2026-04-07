const express = require('express');

const { authenticate } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const patientController = require('../controllers/patientController');
const allergyController = require('../controllers/allergyController');
const conditionController = require('../controllers/conditionController');
const emergencyController = require('../controllers/emergencyController');

const router = express.Router();

router.use(authenticate);

router.get('/', requireRole('patient'), patientController.getOwnProfile);
router.post('/', requireRole('patient'), patientController.createPatientProfile);

router.put('/', requireRole('patient'), patientController.updateOwnProfile);
router.get('/consultations', requireRole('patient'), patientController.getOwnConsultations);

router.post('/grant-access', requireRole('patient'), patientController.grantDoctorAccess);
router.delete('/revoke-access/:doctorId', requireRole('patient'), patientController.revokeDoctorAccess);

router.get('/access-list', requireRole('patient'), patientController.getAccessList);
router.get('/:id', patientController.getPatientById);




// Allergy routes
router.post('/allergies', requireRole('patient'), allergyController.createAllergy);
router.get('/allergies', requireRole('patient'), allergyController.getOwnAllergy);
router.put('/allergies/:id', requireRole('patient'), allergyController.updateAllergy);
router.delete('/allergies/:id', requireRole('patient'), allergyController.deleteAllergy);


// Chronic conditions routes
router.post('/chronic-conditions', requireRole('patient'), conditionController.createCondition);
router.get('/chronic-conditions', requireRole('patient'), conditionController.getOwnConditions);
router.put('/chronic-conditions/:id', requireRole('patient'), conditionController.updateCondition);
router.delete('/chronic-conditions/:id', requireRole('patient'), conditionController.deleteCondition);


// Emergency info
router.post('/emergency-info', requireRole('patient'), emergencyController.addEmergencyInfo);
router.get('/emergency-info', requireRole('patient'), emergencyController.getEmergencyInfo);
router.put('/emergency-info/:id', requireRole('patient'), emergencyController.updateEmergencyInfo);
router.delete('/emergency-info/:id', requireRole('patient'), emergencyController.deleteEmergencyInfo);

module.exports = router;
