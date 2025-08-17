const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { authenticate, requireCompanyHead } = require('../middleware/auth');

// Apply middleware to all routes in this router
router.use(authenticate);

// CRUD Routes
router.post('/', branchController.createBranch);        // Create a branch (Company Head only)
router.get('/', branchController.getAllBranches);       // Get all branches for user's company
router.get('/:id', branchController.getBranchById);     // Get single branch by ID
router.put('/:id', branchController.updateBranch);      // Update branch details

module.exports = router;
