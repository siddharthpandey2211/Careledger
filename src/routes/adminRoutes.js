const express = require('express');

const { authenticate } = require('../middlewares/authMiddleware');
const { requireRole, requireAdmin } = require('../middlewares/roleMiddleware');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('admin'));
router.use(requireAdmin);

router.put('/doctors/:id/verify', adminController.verifyDoctor);

module.exports = router;
