const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// Public routes (no authentication required)
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// Protected routes (authentication required)
router.use(authMiddleware);
// register router under protected routes
router.post('/register', authController.register);
router.get('/profile', authController.getProfile);
router.put('/change-password', authController.changePassword);
router.delete('/delete/:userId', authController.deleteUser);

//All user list for admin
router.get('/users', authController.getAllUsers);

//For users : Teacher, Student, Parent 
router.put('/update/:userId', authController.updateProfile);

module.exports = router;
