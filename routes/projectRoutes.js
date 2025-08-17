const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');


router.use(authenticate);

router.post('/',  projectController.createProject);
router.get('/',  projectController.getAllProjects);
router.get('/:id',projectController.getProjectById);
router.put('/:id', projectController.updateProject);
router.delete('/:id',projectController.deleteProject);

module.exports = router;
