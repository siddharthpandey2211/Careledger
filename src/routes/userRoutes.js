const express = require('express');

const { authenticate } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const userController = require('../controllers/userController');

const router = express.Router();
router.post('/signup', userController.signUpUser);
router.post('/login', userController.userLogin);
router.get('/:id', userController.getUserById);
router.get('/', authenticate, requireRole('admin'), userController.getAllUsers);
router.put('/:id', authenticate, userController.updateUser);
router.delete('/:id', authenticate, requireRole('admin'), userController.deleteUser);

module.exports = router;
