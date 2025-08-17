const mongoose = require('mongoose');

const taskLogSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  isRunning: {
    type: Boolean,
    default: true
  },
  durationMinutes: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('TaskLog', taskLogSchema);
