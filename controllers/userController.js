const User = require('../models/User');

exports.getEmployeesByLoggedInRole = async (req, res) => {
  try {
    const createdBy = req.user?.userId;
    const user = await User.findById(createdBy);

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    let filter = {};

    switch (user.role) {
      case 'SuperAdmin':
        // SuperAdmin -> can see all users
        break;

      case 'Admin':
        // Admin -> all users in same company
        if (!user.companyId) {
          return res.status(400).json({ message: 'Admin must be linked to a company' });
        }
        filter.companyId = user.companyId;
        break;

      case 'BranchManager':
        // BranchManager -> all users in same branch
        if (!user.branchId) {
          return res.status(400).json({ message: 'BranchManager must be linked to a branch' });
        }
        filter.branchId = user.branchId;
        break;

      case 'User':
        // User -> all users in same branch + company head (Admin)
        if (!user.branchId || !user.companyId) {
          return res.status(400).json({ message: 'User must be linked to a branch and company' });
        }

        // 1️⃣ Users from same branch
        const branchFilter = { branchId: user.branchId };

        // 2️⃣ Company head (Admin) of the same company
        const companyHeadFilter = { companyId: user.companyId, role: 'Admin' };

        // Combine both conditions
        filter = { $or: [branchFilter, companyHeadFilter] };
        break;

      default:
        return res.status(403).json({ message: 'Access denied for this role' });
    }

    const users = await User.find(filter)
      .select('-password')
      .populate('companyId branchId departmentId designationId reportingHead', 'name');

    res.status(200).json({
      count: users.length,
      users
    });

  } catch (err) {
    console.error('❌ getEmployeesByLoggedInRole Error:', err);
    res.status(500).json({ error: err.message });
  }
};


// Get Single User by ID (No role-based restrictions)
exports.getUserById = async (req, res) => {
  try {
    const targetUserId = req.params.id;

    const targetUser = await User.findById(targetUserId)
      .select('-password')
      .populate('companyId branchId departmentId designationId reportingHead', 'name');

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(targetUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};