const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    trim: true
  },

  startDate: {
    type: Date,
    required: true
  },

  endDate: {
    type: Date
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },

  status: {
    type: String,
    enum: ['planned', 'active', 'on-hold', 'completed', 'cancelled'],
    default: 'planned'
  },

  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },

  teamLeadId: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],

  managerId: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],

  assignedEmployees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },

  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },

  departmentIds: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Department',
  required: true
}],


  technologies: [{
    type: String,
    trim: true
  }],

  attachments: [{
    fileUrl: String,
    fileName: String
  }],

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }

}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);

// {
//   "name": "E-commerce Platform",
//   "description": "Build a modern e-commerce platform with React and Node.js",
//   "startDate": "2024-01-15",
//   "endDate": "2024-06-30",
//   "priority": "high",
//   "status": "active",
//   "progress": 45,
//   "teamLeadId": "65c8fe236372b5bc14d10729",
//   "managerId": "65c8fe236372b5bc14d10730",
//   "assignedEmployees": [
//     "65c900ab6372b5bc14d10750",
//     "65c900ab6372b5bc14d10751",
//     "65c900ab6372b5bc14d10752"
//   ],
//   "companyId": "65c8fe8a6372b5bc14d1072c",
//   "branchId": "65da9b336372b5bc14d1f999",
//   "departmentIds": [
//     "65c8fef26372b5bc14d10733",
//     "65c8fef26372b5bc14d10734"
//   ],
//   "technologies": ["React", "Node.js", "MongoDB"],
//   "attachments": [
//     {
//       "fileUrl": "https://example.com/docs/requirements.pdf",
//       "fileName": "requirements.pdf"
//     }
//   ],
//   "createdBy": "65c8ff256372b5bc14d10736"
// }

