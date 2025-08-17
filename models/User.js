const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  empId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  name: {
    type: String,
    required: true,
    trim: true
  },

  aliasName: {
    type: String,
    // required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  phone: {
    type: String,
    trim: true
  },

  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'male'
  },

  doj: {
    type: Date,
  },
  address: {
    type: String,
    trim: true
  },

  reportingHead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  password: {
    type: String,
    required: true
  },

  role: {
    type: String,
    enum: ['SuperAdmin', 'Admin', 'BranchManager', 'User'],
    required: true
  },

  avatar: {
    type: String,
    default: function () {
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${this.name || 'user'}`;
    }
  },

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
  },

  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
  },

  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  },
  designationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Designation',
  },

  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active'
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }

}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

// {
//   "empId": "EMP1024",
//   "name": "Jagadeesh Dasari",
//   "aliasName": "Jag",
//   "email": "jagadeesh.d@example.com",
//   "phone": "9876543210",
//   "gender": "male",
//   "doj": "2023-06-01",
//   "address": "Flat 102, Sunrise Apartments, Hyderabad, India",
//   "reportingHead": "65c8fe236372b5bc14d10729", // ObjectId of another user
//   "password": "secureP@ssw0rd",
//   "role": "admin", // must match a valid role document if reference is used
//   "companyId": "65c8fe8a6372b5bc14d1072c", // ObjectId
//   "branchId": "65c8febf6372b5bc14d10730",  // ObjectId
//   "departmentId": "65c8fef26372b5bc14d10733", // ObjectId
//   "status": "active",
//   "createdBy": "65c8ff256372b5bc14d10736" // ObjectId of the creator
// }
