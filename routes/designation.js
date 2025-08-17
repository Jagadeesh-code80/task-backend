const express = require('express');
const router = express.Router();
const designationController = require('../controllers/designationController');
const { authenticate, requireCompanyHead } = require('../middleware/auth');

// Apply middleware to all designation routes
router.use(authenticate);

// CRUD Routes
router.post('/', designationController.createDesignation); 
router.get('/', designationController.getAllDesignations); 
router.get('/:id', designationController.getById); 
router.put('/:id', designationController.updateDesignation);  
router.get('/department/:departmentId', designationController.getDesignationsByDepartment);


module.exports = router;
