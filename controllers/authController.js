const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const moment = require('moment');
const {sendMail} = require('../utils/sendEmail');
const Designation = require('../models/Designation');
const Branch = require('../models/Branch');
const Department = require('../models/Department');
const Company = require('../models/Company');

// Full User Registration Controller
exports.register = async (req, res) => {
  try {
    let {
      empId,
      name,
      aliasName,
      email,
      phone,
      gender,
      doj,
      address,
      reportingHead,
      password,
      role,
      companyId,
      branchId,
      departmentId,
      designationId,
      status,
      createdBy
    } = req.body;

    // 🧩 Common required fields for all roles
    if (!empId || !name || !email || !password || !role) {
      return res.status(400).json({
        message: 'Required fields missing: empId, name, email, password, role'
      });
    }

    // 🧩 Logged-in user details
    const LoginRole = req.user.role;
    const LogInUserDetails = await User.findById(req.user.userId);

    // 🧩 Check if email already exists
    const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        message: 'Email already exists. Please use a different email address.'
      });
    }

    // 🧩 Check if phone already exists (if provided)
    if (phone) {
      const existingPhone = await User.findOne({ phone: phone.trim() });
      if (existingPhone) {
        return res.status(400).json({
          message: 'Phone number already exists. Please use a different number.'
        });
      }
    }

    // 🧩 Checking EmpID logic
    if (LoginRole != 'SuperAdmin') {
      const existingEmpId = await User.findOne({
        empId: empId.trim(),
        companyId: LogInUserDetails.companyId,
      });

      if (existingEmpId) {
        return res.status(400).json({
          message: "Employee ID already exists in your company. Please use a different ID.",
        });
      }
    }

    // 🧩 Role-based permission logic
    if (LoginRole === 'User') {
      return res.status(400).json({ message: 'User cannot create new users' });
    }

    if (LoginRole === 'Admin') {
      req.body.companyId = LogInUserDetails.companyId;
    }

    if (LoginRole === 'BranchManager') {
      req.body.companyId = LogInUserDetails.companyId;
      req.body.branchId = LogInUserDetails.branchId;
    }

    // 🧩 Define required fields per role
    const roleRequirements = {
      Admin: ['companyId'],
      BranchManager: ['companyId', 'branchId'],
      User: ['companyId', 'branchId', 'departmentId', 'designationId']
    };

    // 🧩 Validate role validity
    if (!roleRequirements[role] && role !== 'SuperAdmin') {
      return res.status(400).json({ message: `Invalid role: ${role}` });
    }

    // 🧩 Check for missing role-specific fields
    if (roleRequirements[role]) {
      const missingFields = roleRequirements[role].filter(field => !req.body[field]);
      if (missingFields.length > 0) {
        return res.status(400).json({
          message: `${missingFields.join(', ')} ${missingFields.length > 1 ? 'are' : 'is'} required for ${role} role`
        });
      }
    }

    // 🧩 Hash the password before saving
    // const hashedPassword = await bcrypt.hash(password, 10);

    // 🧩 Build new user object
    let newUserData = {
      empId,
      name,
      aliasName,
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : null,
      gender,
      doj,
      address,
      reportingHead,
      password: password,
      role,
      status: status || 'active',
      createdBy
    };

    // 🧩 Add role-specific fields
    if (roleRequirements[role]) {
      roleRequirements[role].forEach(field => {
        newUserData[field] = req.body[field];
      });
    }

    // 🧩 Create user in DB
    const newUser = await User.create(newUserData);

    // 🧩 Fetch related info dynamically (in parallel where applicable)
const [
  company,
  branch,
  department,
  designation
] = await Promise.all([
  Company.findById(newUser.companyId),
  Branch.findById(newUser.branchId),
  newUser.departmentId ? Department.findById(newUser.departmentId) : null,
  newUser.designationId ? Designation.findById(newUser.designationId) : null
]);

// 🧩 Prepare email context (auto-handles missing dept/designation)
const emailContext = {
  employeeName: newUser.name,
  empId: newUser.empId,
  email: newUser.email,
  password: password, // ⚠️ include only if needed
  companyName: company?.name ?? 'N/A',
  branchName: branch?.name ?? 'N/A',
  departmentName: department?.name ?? 'Not Applicable',
  designationName: designation?.name ?? 'Not Applicable',
  role: newUser.role,
  subject: `Welcome to ${company?.name ?? 'Your Organization'} - Your Account Details`,
  registeredOn: new Date().toLocaleString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }),
  loginUrl: process.env.APP_URL,
  supportEmail: 'support@onobar.com',
  year: new Date().getFullYear()
};

// 🧩 Send registration email
await sendMail(
  newUser.email,
  emailContext.subject,
  'employeeRegistration', // template name (employeeRegistration.html)
  emailContext
);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      userId: newUser._id
    });

  } catch (err) {
    console.error('Registration Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal Server Error'
    });
  }
};

// Login
exports.login = async (req, res) => {
  try {

    const { email, password } = req.body;
    console.log(password)
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid  password' });

    const token = jwt.sign(
      { userId: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    res.status(200).json({ message: 'User authenticated successfully', user: { token, role: user.role, userId: user._id, name: user.name } });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user?.userId; // Extracted from JWT middleware

    if (!userId) {
      return res.status(400).json({ message: 'Unauthorized: Missing user ID' });
    }

    const user = await User.findById(userId)
      .select('-password') // Exclude password field
      .populate('companyId branchId departmentId designationId', 'name'); // Populate related fields

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({ message: 'Unauthorized: Missing user ID' });
    }

    const allowedUpdates = [
      'name',
      'aliasName',
      'phone',
      'gender',
      'doj',
      'address',
      'reportingHead',
      'departmentId',
      'designationId'
    ];

    const updates = {};
    for (let key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!updatedUser) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// Forget Password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
        if (!email) {
      return res.status(404).json({ message: 'email is required.' });
    }
    const user = await User.findOne({ email }).populate('companyId', 'name'); // populate company name


    if (!user) {
      return res.status(404).json({ message: 'No account found with this email.' });
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = Date.now() + 15 * 60 * 1000; // 15 mins
    user.resetToken = resetToken;
    user.resetTokenExpires = tokenExpiry;
await user.save({ validateBeforeSave: false });

    const resetLink = `${process.env.APP_URL}/reset-password/${resetToken}`;

    // ✅ Dynamic company name
    const companyName = user.companyId?.name || 'Task Management';
   
    const emailContext = {
      companyName,
      name: user.name || user.email.split('@')[0],
      resetLink,
      requestedOn: moment().format('MMMM Do YYYY, h:mm:ss a'),
      subject: `Password Reset Request - ${companyName}`,
      year: new Date().getFullYear(),
    };

    await sendMail(user.email, emailContext.subject, 'resetPassword', emailContext);

    return res.status(200).json({ message: 'Password reset email sent successfully.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    if (!password) {
      return res.status(404).json({ message: 'Password is required.' });
    }
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpires: { $gt: Date.now() },
    }).populate('companyId', 'name');

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
await user.save({ validateBeforeSave: false });

    const companyName = user.companyId?.name || 'Task Management';

const emailContext = {
  companyName: user.companyId?.name || 'Task Management',
  contactName: user.name || user.email.split('@')[0],
  resetTime: moment().format('MMMM Do YYYY, h:mm:ss a'),
  userEmail: user.email,
  dashboardUrl: `${process.env.APP_URL}`,
  subject: `Your Password Has Been Reset Successfully - ${companyName}`,
  year: new Date().getFullYear(),
};


await sendMail(user.email, emailContext.subject, 'passwordResetSuccess', emailContext);

    return res.status(200).json({ message: 'Password reset successful and confirmation email sent.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

