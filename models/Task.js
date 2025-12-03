const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },

  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },

  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  status: {
    type: String,
    enum: [
      "todo",
      "in-progress",
      "in-review",
      "qa-review",
      "qa-tested",
      "product-review",
      "ready-for-release",
      "completed",
      "blocked",
      "reopened",
      "on-hold",
      "cancelled"
    ],
    default: "todo"
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },

  // Task Type (Dropdown)
  taskType: {
    type: String,
    enum: [
      "feature",
      "bug",
      "improvement",
      "enhancement",
      "ui-change",
      "backend-task",
      "dev-task",
      "qa-task",
      "documentation",
      "research",
      "hotfix",
      "support"
    ],
    default: "feature"
  },

  startDate: Date,
  dueDate: Date,
  completedDate: Date,
  estimatedHours: { type: String, trim: true },
  actualHours: { type: String, trim: true },
  workedHours: { type: String, default: "00:00:00" },
  progress: { type: Number, min: 0, max: 100, default: 0 },

  isParent: { type: Boolean, default: false },
  parentTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  subTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],

  attachments: [{ fileUrl: String, fileName: String }],

  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    comment: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
  }],

  // Status change history
  statusHistory: [{
    fromStatus: { type: String },
    toStatus: { type: String },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now }
  }],

  // GENERAL TASK UPDATE LOG
  taskUpdates: [{
    updateType: { type: String },
    oldValue: { type: String },
    newValue: { type: String },
    remarks: { type: String, trim: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now }
  }]

}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
