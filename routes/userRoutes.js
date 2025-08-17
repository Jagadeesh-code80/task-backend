const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Get all employees based on logged-in role
router.get('/', userController.getEmployeesByLoggedInRole);

// Get single employee by ID based on logged-in role
router.get('/:id', userController.getUserById);

module.exports = router;
