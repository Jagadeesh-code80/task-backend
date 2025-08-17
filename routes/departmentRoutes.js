const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authenticate, requireCompanyHead } = require('../middleware/auth');

// Apply middleware to all department routes
router.use(authenticate);

// CRUD Routes
router.post('/', departmentController.createDepartment);            // Create department
router.get('/branch/:branchId', departmentController.getByBranch); // Get departments by branch
router.get('/:id', departmentController.getById);                  // Get department by ID
router.put('/:id', departmentController.updateDepartment);         // Update department
router.get('/', departmentController.getAllDepartments);          // Get all departments

module.exports = router;
