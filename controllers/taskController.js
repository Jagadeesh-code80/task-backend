const Task = require('../models/Task');
const TaskLog = require('../models/TaskLog');
const User = require('../models/User');
const Project = require('../models/Project');

// Create Task
exports.createTask = async (req, res) => {
  try {
    const createdBy = req.user?.userId;
    const user = await User.findById(createdBy);

    if (!user || !user.companyId) {
      return res.status(403).json({ message: 'Invalid user or missing company details' });
    }

    const {
      title,
      description,
      projectId,
      assignedTo,
      departmentId,
      status,
      priority,
      startDate,
      dueDate,
      estimatedHours,
      actualHours,
      progress,
      parentTaskId,
      attachments,
      branchId // now taken from request body
    } = req.body;

    // Validate project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const newTask = new Task({
      title,
      description,
      projectId,
      assignedTo,
      departmentId,
      status,
      priority,
      startDate,
      dueDate,
      estimatedHours,
      actualHours,
      progress,
      parentTaskId,
      attachments,
      createdBy,
      companyId: user.companyId,
      branchId:project.branchId
    });

    await newTask.save();

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task: newTask
    });
  } catch (err) {
    console.error('Create Task Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get All Tasks (Role-based access)
exports.getAllTasks = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId);
    if (!user || !user.role) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    let filter = {};

    if (user.role === 'Admin') {
      filter.companyId = user.companyId;
    } else if (user.role === 'BranchManager') {
      filter.branchId = user.branchId;
    } else {
      filter.$or = [
        { createdBy: userId },
        { assignedTo: userId }
      ];
    }

    const tasks = await Task.find(filter)
      .populate('projectId', 'name')
      .populate('assignedTo', 'name email avatar')
      // .populate('departmentId', 'name')
      .populate('createdBy', 'name email avatar')
      .populate('lastUpdatedBy', 'name email avatar')
      .populate('parentTaskId', 'title');

    res.status(200).json({ count: tasks.length, tasks });
  } catch (err) {
    console.error('Get All Tasks Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get Task by ID
exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('projectId', 'name')
      .populate('assignedTo', 'name email avatar')
      .populate('departmentId', 'name')
      .populate('createdBy', 'name email avatar')
      .populate('lastUpdatedBy', 'name email avatar')
      .populate('parentTaskId', 'title');

    if (!task) return res.status(404).json({ message: 'Task not found' });

    res.status(200).json({ task });
  } catch (err) {
    console.error('Get Task Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update Task
exports.updateTask = async (req, res) => {
  try {
    const lastUpdatedBy = req.user?.userId;

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastUpdatedBy },
      { new: true, runValidators: true }
    );

    if (!updatedTask) return res.status(404).json({ message: 'Task not found' });

    res.status(200).json({ message: 'Task updated successfully', task: updatedTask });
  } catch (err) {
    console.error('Update Task Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete Task
exports.deleteTask = async (req, res) => {
  try {
    const deleted = await Task.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Task not found' });

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Delete Task Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Toggle Task Log (Start / Stop)
exports.toggleTaskLog = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { taskId, isRunning } = req.body;

    if (!taskId) {
      return res.status(400).json({ message: 'Task ID is required' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // ===================== START TASK =====================
    if (isRunning) {
      // Close any other running log for this user
      const previousLog = await TaskLog.findOne({ userId, isRunning: true });
      if (previousLog) {
        previousLog.isRunning = false;
        previousLog.endTime = new Date();
        previousLog.durationMinutes = Math.floor(
          (previousLog.endTime - previousLog.startTime) / (1000 * 60)
        );
        await previousLog.save();
      }

      // Start a new log
      const newLog = new TaskLog({
        taskId,
        userId,
        startTime: new Date(),
        isRunning: true
      });
      await newLog.save();

      return res.status(201).json({
        message: 'Task started successfully',
        log: newLog
      });
    }

    // ===================== STOP TASK =====================
   else {
  const runningLog = await TaskLog.findOne({ taskId, userId, isRunning: true });
  if (!runningLog) {
    return res.status(400).json({ message: 'No running log found for this task' });
  }

  runningLog.isRunning = false;
  runningLog.endTime = new Date();
  runningLog.durationMinutes = Math.floor(
    (runningLog.endTime - runningLog.startTime) / (1000 * 60)
  );

  await runningLog.save();

  // 🔹 Calculate total duration for this task (all logs)
  const allLogs = await TaskLog.find({ taskId });
  const totalMinutes = allLogs.reduce((sum, log) => sum + (log.durationMinutes || 0), 0);

  // Convert total minutes -> HH:mm
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const formattedTime = `${hours}:${String(minutes).padStart(2, '0')}`;

  // 🔹 Update Task with hh:mm format
  await Task.findByIdAndUpdate(taskId, {
    actualHours: formattedTime
  }, { new: true });

  return res.status(200).json({
    message: 'Task stopped successfully',
    log: runningLog,
    actualHours: formattedTime
  });
}
  } catch (err) {
    console.error('Toggle TaskLog Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Get all Task Logs
exports.getAllTaskLogs = async (req, res) => {
  try {
    const logs = await TaskLog.find()
      .populate("taskId", "name description") // populate task fields
      .populate("userId", "name email"); // populate user fields

    res.status(200).json({
      message: "All task logs fetched successfully",
      count: logs.length,
      logs,
    });
  } catch (err) {
    console.error("Get All TaskLogs Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
// Get Task Logs by Task ID
exports.getTaskLogsByTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({ message: "Task ID is required" });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const logs = await TaskLog.find({ taskId })
      .populate("userId", "name email") // populate user fields
      .sort({ startTime: -1 }); // latest first

    // 🔹 Calculate total hours for this task
    const totalMinutes = logs.reduce(
      (sum, log) => sum + (log.durationMinutes || 0),
      0
    );
    const totalHours = parseFloat((totalMinutes / 60).toFixed(2));

    res.status(200).json({
      message: "Task logs fetched successfully",
      task: { _id: task._id, name: task.name },
      totalHours,
      logs,
    });
  } catch (err) {
    console.error("Get TaskLogs By Task Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
