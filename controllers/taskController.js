const Task = require('../models/Task');
const TaskLog = require('../models/TaskLog');
const User = require('../models/User');
const Project = require('../models/Project');
const mongoose = require('mongoose');


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
      return res.status(400).json({ message: "Task ID is required" });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Convert UTC → IST (+5:30)
    const currentISTTime = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);

    // ===================== START TASK =====================
    if (isRunning) {
      // Stop any previously running log for this user
      const previousLog = await TaskLog.findOne({ userId, isRunning: true });
      if (previousLog) {
        previousLog.isRunning = false;
        previousLog.endTime = currentISTTime;

        const diffSeconds = Math.floor((previousLog.endTime - previousLog.startTime) / 1000);
        previousLog.workedHours = formatSecondsToHHMMSS(diffSeconds);

        await previousLog.save();
      }

      // Start a new log for this task
      const newLog = new TaskLog({
        taskId,
        userId,
        startTime: currentISTTime,
        isRunning: true,
        workedHours: "00:00:00",
      });
      await newLog.save();

      return res.status(201).json({
        message: "✅ Task started successfully",
        log: newLog,
      });
    }

    // ===================== STOP TASK =====================
    else {
      const runningLog = await TaskLog.findOne({ taskId, userId, isRunning: true });
      if (!runningLog) {
        return res.status(400).json({ message: "No running log found for this task" });
      }

      runningLog.isRunning = false;
      runningLog.endTime = currentISTTime;

      // Calculate time difference
      const workedSeconds = Math.floor((runningLog.endTime - runningLog.startTime) / 1000);
      runningLog.workedHours = formatSecondsToHHMMSS(workedSeconds);
      await runningLog.save();

      // 🔹 Total worked seconds for this task (all users)
      const allLogs = await TaskLog.find({ taskId });
      const totalSeconds = allLogs.reduce((sum, log) => {
        if (!log.workedHours) return sum;
        const [h, m, s] = log.workedHours.split(":").map(Number);
        return sum + (h * 3600 + m * 60 + s);
      }, 0);

      const formattedActualTime = formatSecondsToHHMMSS(totalSeconds);

      // 🔹 Add to task's previous workedHours
      const prevWorked = task.workedHours
        ? task.workedHours.split(":").map(Number)
        : [0, 0, 0];
      const prevWorkedSeconds = prevWorked[0] * 3600 + prevWorked[1] * 60 + prevWorked[2];
      const totalWorkedSeconds = prevWorkedSeconds + workedSeconds;
      const formattedWorkedTime = formatSecondsToHHMMSS(totalWorkedSeconds);

      // 🔹 Update Task
      await Task.findByIdAndUpdate(taskId, {
        actualHours: formattedActualTime,
        workedHours: formattedWorkedTime,
      });

      return res.status(200).json({
        message: "⏹️ Task stopped successfully",
        log: runningLog,
        actualHours: formattedActualTime,
        workedHours: formattedWorkedTime,
      });
    }
  } catch (err) {
    console.error("❌ Toggle TaskLog Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.getAllLogs = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { taskId } = req.query; // optional filter
    const user = await User.findById(userId).lean();

    if (!user || !user.role) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    // 🔹 Base aggregation pipeline
    const pipeline = [];

    // 1️⃣ Optional filter by taskId (if provided)
    if (taskId) {
      pipeline.push({
        $match: { taskId: new mongoose.Types.ObjectId(taskId) }
      });
    }

    // 2️⃣ Lookup task details
    pipeline.push(
      {
        $lookup: {
          from: 'tasks',
          localField: 'taskId',
          foreignField: '_id',
          as: 'task'
        }
      },
      { $unwind: { path: '$task', preserveNullAndEmptyArrays: false } },

      // 3️⃣ Lookup user who created the log
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },

      // 4️⃣ Lookup project, company, branch
      {
        $lookup: {
          from: 'projects',
          localField: 'task.projectId',
          foreignField: '_id',
          as: 'project'
        }
      },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: 'companies',
          localField: 'task.companyId',
          foreignField: '_id',
          as: 'company'
        }
      },
      { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: 'branches',
          localField: 'task.branchId',
          foreignField: '_id',
          as: 'branch'
        }
      },
      { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },

      // 5️⃣ Lookup assigned users
      {
        $lookup: {
          from: 'users',
          localField: 'task.assignedTo',
          foreignField: '_id',
          as: 'assignedUsers'
        }
      }
    );

    // 6️⃣ Role-based access filter
    pipeline.push({
      $match: (function () {
        if (user.role === 'Admin') {
          return { 'task.companyId': new mongoose.Types.ObjectId(user.companyId) };
        } else if (user.role === 'BranchManager') {
          return { 'task.branchId': new mongoose.Types.ObjectId(user.branchId) };
        } else {
          return {
            $or: [
              { 'user._id': new mongoose.Types.ObjectId(userId) },
              { 'task.assignedTo': new mongoose.Types.ObjectId(userId) }
            ]
          };
        }
      })()
    });

    // 7️⃣ Final projection
    pipeline.push({
      $project: {
        _id: 1,
        startTime: 1,
        endTime: 1,
        workedHours: 1,
        isRunning: 1,
        createdAt: 1,
        updatedAt: 1,
        user: { _id: 1, name: 1, email: 1, role: 1 },
        task: { _id: 1, title: 1, status: 1, priority: 1 },
        project: { _id: 1, name: 1 },
        company: { _id: 1, name: 1 },
        branch: { _id: 1, name: 1 },
        assignedUsers: {
          $map: {
            input: '$assignedUsers',
            as: 'u',
            in: { _id: '$$u._id', name: '$$u.name', email: '$$u.email' }
          }
        }
      }
    });

    // Execute aggregation
    const logs = await TaskLog.aggregate(pipeline).allowDiskUse(true);

    return res.status(200).json({
      message: taskId
        ? 'Task logs fetched successfully'
        : 'All task logs fetched successfully',
      count: logs.length,
      logs
    });

  } catch (err) {
    console.error('Aggregation Get TaskLogs Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Helper function
function formatSecondsToHHMMSS(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    seconds.toString().padStart(2, "0"),
  ].join(":");
}