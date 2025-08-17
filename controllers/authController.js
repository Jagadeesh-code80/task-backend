const User = require('../models/User');
const jwt = require('jsonwebtoken');


// Full User Registration Controller
exports.register = async (req, res) => {
  try {
    const {
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

    // Common required fields for all roles
    if (!empId || !name || !email || !password || !role) {
      return res.status(400).json({
        message:
          'Required fields missing: empId, name, email, password, role'
      });
    }

    // Role-specific required fields mapping
    const roleRequirements = {
      Admin: ['companyId'],
      BranchManager: ['companyId', 'branchId'],
      User: ['companyId', 'branchId', 'departmentId', 'designationId']
    };

    // Validate role existence
    if (!roleRequirements[role] && role !== 'SuperAdmin') {
      return res.status(400).json({ message: `Invalid role: ${role}` });
    }

    // Check missing role-specific fields
    if (roleRequirements[role]) {
      const missingFields = roleRequirements[role].filter(field => !req.body[field]);
      if (missingFields.length > 0) {
        return res.status(400).json({
          message: `${missingFields.join(', ')} ${
            missingFields.length > 1 ? 'are' : 'is'
          } required for ${role} role`
        });
      }
    }

    // Check for existing user
    const existingUser = await User.findOne({
      $or: [{ email }, { empId }]
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: 'Email or Employee ID already exists' });
    }

    // Build new user payload dynamically
    let newUserData = {
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
      status,
      createdBy
    };

    // Add role-specific fields
    if (roleRequirements[role]) {
      roleRequirements[role].forEach(field => {
        newUserData[field] = req.body[field];
      });
    }

    // Create user
    const newUser = await User.create(newUserData);

    res
      .status(201)
      .json({ message: 'User registered successfully', userId: newUser._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid email' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid  password' });

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
      return res.status(401).json({ message: 'Unauthorized: Missing user ID' });
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
      return res.status(401).json({ message: 'Unauthorized: Missing user ID' });
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
