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
    enum: ['todo', 'in-progress', 'in-review', 'completed', 'blocked'],
    default: 'todo'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },

  startDate: Date,
  dueDate: Date,
  completedDate: Date,
  estimatedHours: { type: String, trim: true },
  actualHours: { type: String, trim: true },
  workedHours: { type: String, trim: true },
  progress: { type: Number, min: 0, max: 100, default: 0 },

  // 👇 Hierarchical task structure
  isParent: { type: Boolean, default: false }, // true if it's a top-level parent task
  parentTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  subTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }], // all direct children

  // File attachments
  attachments: [{ fileUrl: String, fileName: String }],

  // Comments
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    comment: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
  }],

}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
