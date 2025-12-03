const Task = require('../models/Task');
const TaskLog = require('../models/TaskLog');
const User = require('../models/User');
const Project = require('../models/Project');
const mongoose = require('mongoose');
const moment = require('moment');
const {sendMail} = require('../utils/sendEmail');

// Create or Create Subtask
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
      attachments
    } = req.body;

    // ✅ Validate project
    const project = await Project.findById(projectId).populate('companyId', 'name branchId');
    if (!project) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    // ✅ Check if this is a parent or child
    let isParent = false;
    let branchId = project.branchId;

    let parentTask = null;
    if (parentTaskId) {
      parentTask = await Task.findById(parentTaskId);
      if (!parentTask) {
        return res.status(404).json({ message: 'Parent task not found' });
      }

      // Mark parent as parent task if not already
      if (!parentTask.isParent) {
        parentTask.isParent = true;
        await parentTask.save();
      }
    } else {
      isParent = true;
    }
    // console.log('Is Parent Task:', isParent, req.body); return

    // ✅ Create task
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
      parentTaskId: parentTaskId || null,
      isParent,
      attachments,
      createdBy,
      companyId: user.companyId,
      branchId
    });

    await newTask.save();

    // ✅ If child task → push into parent.subTasks
    if (parentTaskId) {
      await Task.findByIdAndUpdate(parentTaskId, {
        $push: { subTasks: newTask._id }
      });
    }

    // ✅ Send email notifications
    if (assignedTo && assignedTo.length > 0) {
      const assignedUsers = await User.find({ _id: { $in: assignedTo } });

      for (const assignee of assignedUsers) {
        const emailContext = {
          companyName: project.companyId?.name || 'Task Management',
          employeeName: assignee.name || assignee.email.split('@')[0],
          taskTitle: title,
          projectName: project.name,
          assignedBy: user.name || 'Project Manager',
          description: description || 'No description provided.',
          priority: priority || 'Normal',
          startDate: startDate ? moment(startDate).format('MMMM Do YYYY') : 'Not specified',
          dueDate: dueDate ? moment(dueDate).format('MMMM Do YYYY') : 'Not specified',
          dashboardUrl: `${process.env.APP_URL}/tasks`,
          supportEmail: process.env.SUPPORT_EMAIL || 'support@company.com',
          subject: `New Task Assigned: ${title}`,
          year: new Date().getFullYear(),
        };

        await sendMail(assignee.email, emailContext.subject, 'taskAssigned', emailContext);
      }
    }

    res.status(201).json({
      success: true,
      message: parentTaskId
        ? 'Child task created and linked successfully'
        : 'Parent task created successfully',
      task: newTask
    });

  } catch (err) {
    console.error('Create Task Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Get All Tasks (Role-based + Nested + Parent Inclusion + Running Logs Mapping)
exports.getAllTasks = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId);
    if (!user || !user.role) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    let filter = {};

    // Role-based filters
    if (user.role === 'Admin') filter.companyId = user.companyId;
    else if (user.role === 'BranchManager') filter.branchId = user.branchId;
    else filter.$or = [{ createdBy: userId }, { assignedTo: userId }];

    // 1️⃣ Fetch all tasks for this user/role
    const tasks = await Task.find(filter)
      .populate('projectId', 'name')
      .populate('assignedTo', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .populate('lastUpdatedBy', 'name email avatar')
       .populate('statusHistory.changedBy', 'name email avatar')
      .lean();

    const taskIds = tasks.map(t => t._id);

    // 2️⃣ Fetch all running logs for these tasks in one query
    const logs = await TaskLog.find({
      taskId: { $in: taskIds },
      isRunning: true
    })
      .populate('userId', 'name email avatar')
      .sort({ createdAt: -1 })
      .lean();

    // 3️⃣ Build a map of logs per task
    const logsMap = {};
    logs.forEach(log => {
      const tid = log.taskId.toString();
      if (!logsMap[tid]) logsMap[tid] = [];
      logsMap[tid].push(log);
    });

    // 4️⃣ Build task hierarchy in memory
    const taskMap = {};
    tasks.forEach(t => {
      taskMap[t._id.toString()] = { ...t, subtasks: [], runningLog: logsMap[t._id.toString()] || [] };
    });

    const topLevelTasks = [];
    tasks.forEach(t => {
      if (t.parentTaskId) {
        const parent = taskMap[t.parentTaskId.toString()];
        if (parent) parent.subtasks.push(taskMap[t._id.toString()]);
      } else {
        topLevelTasks.push(taskMap[t._id.toString()]);
      }
    });

    res.status(200).json({
      count: topLevelTasks.length,
      tasks: topLevelTasks
    });

  } catch (err) {
    console.error('❌ Get All Tasks Error:', err);
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
      .populate('parentTaskId', 'title')
      .populate('statusHistory.changedBy', 'name email avatar'); 

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

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


exports.toggleTaskLog = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { taskId, isRunning } = req.body;

    if (!taskId) return res.status(400).json({ message: "Task ID is required" });

    const task = await Task.findById(taskId).lean();
    if (!task) return res.status(404).json({ message: "Task not found" });

    const now = new Date();

    // Helper: seconds ↔ HH:MM:SS
    const formatSeconds = (s) => {
      const h = String(Math.floor(s / 3600)).padStart(2, "0");
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const sec = String(s % 60).padStart(2, "0");
      return `${h}:${m}:${sec}`;
    };
    const toSeconds = (str) => {
      if (!str) return 0;
      const [h, m, s] = str.split(":").map(Number);
      return h * 3600 + m * 60 + s;
    };

    if (isRunning) {
      // Stop previous running log for this user
      const previousLog = await TaskLog.findOne({ userId, isRunning: true });
      if (previousLog) {
        const diff = Math.floor((now - previousLog.startTime) / 1000);
        previousLog.isRunning = false;
        previousLog.endTime = now;
        previousLog.workedHours = formatSeconds(diff);
        await previousLog.save();
      }

      // Start new log
      const newLog = await TaskLog.create({
        taskId,
        userId,
        startTime: now,
        isRunning: true,
        workedHours: "00:00:00",
      });

      return res.status(201).json({ message: "✅ Task started", log: newLog });

    } else {
      // Stop current running log
      const runningLog = await TaskLog.findOne({ taskId, userId, isRunning: true });
      if (!runningLog) return res.status(400).json({ message: "No running log found" });

      const diffSeconds = Math.floor((now - runningLog.startTime) / 1000);
      runningLog.isRunning = false;
      runningLog.endTime = now;
      runningLog.workedHours = formatSeconds(diffSeconds);

      // Update task actual/worked hours using $inc
      const previousWorked = toSeconds(task.workedHours);
      const totalWorked = previousWorked + diffSeconds;

      const totalActual = toSeconds(task.actualHours || "00:00:00") + diffSeconds;

      await Promise.all([
        runningLog.save(),
        Task.findByIdAndUpdate(taskId, {
          workedHours: formatSeconds(totalWorked),
          actualHours: formatSeconds(totalActual),
        })
      ]);

      return res.status(200).json({
        message: "⏹️ Task stopped",
        log: runningLog,
        workedHours: formatSeconds(totalWorked),
        actualHours: formatSeconds(totalActual)
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

exports.getAttendance = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const {
      employeeId,
      branchId,
      deptId,
      designationId,
      fromDate,
      toDate
    } = req.query;

    const user = await User.findById(userId).lean();
    if (!user || !user.role) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    // 🗓️ Date range
    let startDate, endDate;
    if (fromDate && toDate) {
      startDate = new Date(fromDate);
      endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const today = new Date();
      startDate = new Date(today.setHours(0, 0, 0, 0));
      endDate = new Date(today.setHours(23, 59, 59, 999));
    }

    // 🧩 Parse comma-separated IDs
    const parseIds = (param) =>
      param ? param.split(',').map((id) => new mongoose.Types.ObjectId(id.trim())) : [];

    const branchIds = parseIds(branchId);
    const deptIds = parseIds(deptId);
    const designationIds = parseIds(designationId);
    const employeeIds = parseIds(employeeId);

    // 🧩 Role-based filter
    const matchStage = { createdAt: { $gte: startDate, $lte: endDate } };

    if (user.role === 'Admin') {
      matchStage['task.companyId'] = new mongoose.Types.ObjectId(user.companyId);
    } else if (user.role === 'BranchManager') {
      matchStage['task.branchId'] = new mongoose.Types.ObjectId(user.branchId);
    } else {
      matchStage['userId'] = new mongoose.Types.ObjectId(userId);
    }

    // 🧩 Extra filters
    if (employeeIds.length) matchStage['userId'] = { $in: employeeIds };
    if (branchIds.length) matchStage['task.branchId'] = { $in: branchIds };
    if (deptIds.length) matchStage['user.departmentId'] = { $in: deptIds };
    if (designationIds.length) matchStage['user.designationId'] = { $in: designationIds };

    // 🧮 Aggregate daily logs
    const logs = await TaskLog.aggregate([
      {
        $lookup: {
          from: 'tasks',
          localField: 'taskId',
          foreignField: '_id',
          as: 'task'
        }
      },
      { $unwind: '$task' },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $match: matchStage },
      {
        $addFields: {
          workedSeconds: {
            $let: {
              vars: { parts: { $split: ['$workedHours', ':'] } },
              in: {
                $add: [
                  { $multiply: [{ $toInt: { $arrayElemAt: ['$$parts', 0] } }, 3600] },
                  { $multiply: [{ $toInt: { $arrayElemAt: ['$$parts', 1] } }, 60] },
                  { $toInt: { $arrayElemAt: ['$$parts', 2] } }
                ]
              }
            }
          }
        }
      },
      {
        $group: {
          _id: {
            userId: '$user._id',
            userName: '$user.name',
            email: '$user.email',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          totalSeconds: { $sum: '$workedSeconds' }
        }
      },
      {
        $addFields: {
          workedHours: {
            $concat: [
              {
                $cond: [
                  { $lt: [{ $floor: { $divide: ['$totalSeconds', 3600] } }, 10] },
                  { $concat: ['0', { $toString: { $floor: { $divide: ['$totalSeconds', 3600] } } }] },
                  { $toString: { $floor: { $divide: ['$totalSeconds', 3600] } } }
                ]
              },
              ':',
              {
                $cond: [
                  { $lt: [{ $mod: [{ $floor: { $divide: ['$totalSeconds', 60] } }, 60] }, 10] },
                  { $concat: ['0', { $toString: { $mod: [{ $floor: { $divide: ['$totalSeconds', 60] } }, 60] } }] },
                  { $toString: { $mod: [{ $floor: { $divide: ['$totalSeconds', 60] } }, 60] } }
                ]
              },
              ':',
              {
                $cond: [
                  { $lt: [{ $mod: ['$totalSeconds', 60] }, 10] },
                  { $concat: ['0', { $toString: { $mod: ['$totalSeconds', 60] } }] },
                  { $toString: { $mod: ['$totalSeconds', 60] } }
                ]
              }
            ]
          }
        }
      },
      {
        $project: {
          _id: 0,
          userId: '$_id.userId',
          userName: '$_id.userName',
          email: '$_id.email',
          date: '$_id.date',
          workedHours: 1,
          totalSeconds: 1
        }
      },
      { $sort: { date: -1 } }
    ]);

    // 🧾 Build full date range
    const allDates = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      allDates.push(new Date(d).toISOString().split('T')[0]);
    }

    // 🧩 Get all users in filter scope
    const userFilter = {};
    if (user.role === 'Admin') userFilter.companyId = user.companyId;
    if (user.role === 'BranchManager') userFilter.branchId = user.branchId;
    if (branchIds.length) userFilter.branchId = { $in: branchIds };
    if (deptIds.length) userFilter.departmentId = { $in: deptIds };
    if (designationIds.length) userFilter.designationId = { $in: designationIds };
    if (employeeIds.length) userFilter._id = { $in: employeeIds };

    const users = await User.find(userFilter, { _id: 1, name: 1, email: 1 }).lean();

    // 🧾 Combine logs + missing dates (workedHours = 0)
    const attendance = [];
    for (const u of users) {
      for (const date of allDates) {
        const found = logs.find(
          (l) => l.userId.toString() === u._id.toString() && l.date === date
        );
        attendance.push({
          userId: u._id,
          userName: u.name,
          email: u.email,
          date,
          workedHours: found ? found.workedHours : '00:00:00'
        });
      }
    }

    // 🧮 Build summary (total workedHours per employee)
    const summaryMap = {};
    for (const a of attendance) {
      if (!summaryMap[a.userId]) summaryMap[a.userId] = { ...a, totalSeconds: 0 };
      const parts = a.workedHours.split(':').map(Number);
      summaryMap[a.userId].totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    const summary = Object.values(summaryMap).map((s) => {
      const h = Math.floor(s.totalSeconds / 3600);
      const m = Math.floor((s.totalSeconds % 3600) / 60);
      const sec = s.totalSeconds % 60;
      const format = (v) => (v < 10 ? `0${v}` : v);
      return {
        userId: s.userId,
        userName: s.userName,
        email: s.email,
        totalWorkedHours: `${format(h)}:${format(m)}:${format(sec)}`
      };
    });

    // 🧹 Sort by date (latest first)
    attendance.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      message: 'Attendance fetched successfully',
      count: attendance.length,
      attendance,
      summary
    });
  } catch (err) {
    console.error('Get Attendance Error:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
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


// Status Tracker
exports.updateTaskStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const updatedBy = req.user?.userId;

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const oldStatus = task.status;

    // If status doesn't change
    if (oldStatus === status) {
      return res.status(200).json({ message: "Status already same", task });
    }

    // Update main task status
    task.status = status;
    task.lastUpdatedBy = updatedBy;

    // ⭐ Add status history entry
    task.statusHistory.push({
      fromStatus: oldStatus,
      toStatus: status,
      changedBy: updatedBy,
      changedAt: new Date()
    });

    // ⭐ Add general task update log
    task.taskUpdates.push({
      updateType: "status-change",
      oldValue: oldStatus,
      newValue: status,
      remarks: remarks || "",
      updatedBy,
      updatedAt: new Date()
    });

    await task.save();

    res.status(200).json({
      message: "Task status updated successfully",
      task
    });

  } catch (err) {
    console.error("Task Status Update Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

