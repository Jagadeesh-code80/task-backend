const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, requireCompanyHead } = require('../middleware/auth');

router.post('/register',authenticate, authController.register);
router.post('/login', authController.login);
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);
module.exports = router;
