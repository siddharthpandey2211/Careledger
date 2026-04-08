const express = require('express');

const userRoutes = require('./userRoutes');
const authRoutes = require('./authRoutes');
const patientRoutes = require('./patientRoutes');
const doctorRoutes = require('./doctorRoutes');
const consultationRoutes = require('./consultationRoutes');
const adminRoutes = require('./adminRoutes');
const activeMedicationRoutes = require('./activeMedicationRoutes');
const ocrRoutes = require('./ocrRoutes');
const clinicsRoutes = require('./clinicsRoutes');

const router = express.Router();

router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/doctors', doctorRoutes);
router.use('/consultations', consultationRoutes);
router.use('/admin', adminRoutes);
router.use('/medications', activeMedicationRoutes);
router.use('/ocr', ocrRoutes);
router.use('/clinics', clinicsRoutes);

module.exports = router;
