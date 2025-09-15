const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticate);

// Routes
router.post('/', taskController.createTask);
router.get('/', taskController.getAllTasks);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);
router.post('/toggle', taskController.toggleTaskLog);
router.get("/logs", taskController.getAllTaskLogs);

router.get("/logs/:taskId", taskController.getTaskLogsByTask);

module.exports = router;
