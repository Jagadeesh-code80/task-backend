const Branch = require('../models/Branch');
const User = require('../models/User');

// Create Branch (Only by company_head)
exports.createBranch = async (req, res) => {
  try {
    const createdBy = req.user?.userId;
    if (!createdBy) return res.status(401).json({ message: 'Unauthorized: Missing user info from token' });

    const currentUser = await User.findById(createdBy);
    if (!currentUser || currentUser.role !== 'Admin') {
      return res.status(403).json({ message: 'Only company head can create branches' });
    }

    if (!req.body?.name || !req.body?.code) {
      return res.status(400).json({ message: 'Branch name and code are required' });
    }

    const newBranch = await Branch.create({
      name: req.body.name,
      code: req.body.code,
      status: req.body.status || 'active',
      companyId: currentUser.companyId,
      createdBy
    });

    res.status(201).json({ message: 'Branch created successfully', branch: newBranch });
  } catch (err) {
    console.error('Create branch error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get All Branches (Only from user's company)
exports.getAllBranches = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user?.companyId) return res.status(404).json({ error: 'User not linked to any company' });

    const branches = await Branch.find({ companyId: user.companyId, status: 'active' });
    res.json(branches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Branch by ID (Restricted to same company)
exports.getBranchById = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const branch = await Branch.findById(req.params.id);

    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    if (branch.companyId.toString() !== user.companyId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(branch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Branch (Only company_head of same company)
exports.updateBranch = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const branch = await Branch.findById(req.params.id);

    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    if (user.role !== 'Admin' || branch.companyId.toString() !== user.companyId.toString()) {
      return res.status(403).json({ error: 'Unauthorized to update this branch' });
    }

    const updated = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: 'Branch updated successfully', branch: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Soft Delete Branch
exports.deleteBranch = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const branch = await Branch.findById(req.params.id);

    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    if (branch.companyId.toString() !== user.companyId.toString()) {
      return res.status(403).json({ error: 'Unauthorized to delete this branch' });
    }

    branch.status = 'inactive';
    await branch.save();

    res.json({ message: 'Branch deactivated successfully', branch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
