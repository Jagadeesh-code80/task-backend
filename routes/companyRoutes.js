const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Apply middleware to all routes in this router
router.use(authenticate);

// CRUD Routes
router.post('/', companyController.createCompany);        // Create company
router.get('/', companyController.getAllCompanies);       // Get all companies
router.get('/:id', companyController.getCompanyById);     // Get company by ID
router.put('/:id', companyController.updateCompany);      // Update company

module.exports = router;
