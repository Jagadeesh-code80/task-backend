const mongoose = require('mongoose');
const Department = require('../models/Department');
const User = require('../models/User');
const Branch = require('../models/Branch');

// Create Department
exports.createDepartment = async (req, res) => {
  try {
    const { name, status = 'active', branchId } = req.body;

    if (!name || !branchId) {
      return res.status(400).json({ message: 'Department name and branch ID are required' });
    }
    const createdBy = req.user?.userId;
    const user = await User.findById(createdBy);
    if (!user || !user.companyId) {
      return res.status(403).json({ message: 'User or company not found' });
    }
    const companyId = user.companyId;

    const branch = await Branch.findOne({ _id: branchId, companyId });
    if (!branch) {
      return res.status(404).json({ message: 'Branch does not exist under your company' });
    }

    const duplicate = await Department.findOne({
      name: name.trim(),
      branchId,
      companyId,
    });

    if (duplicate) {
      return res.status(400).json({ message: 'Department with this name already exists in the branch' });
    }

    const department = await Department.create({
      name: name.trim(),
      status,
      branchId,
      companyId,
      createdBy,
    });

    res.status(201).json({
      message: 'Department created successfully',
      department,
    });

  } catch (err) {
    console.error('Create Department Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAllDepartments = async (req, res) => {
  try {
    const user = await User.findById(req.user?.userId)
      .populate("companyId branchId");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let departments = [];

    switch (user.role) {
      case "SuperAdmin":
        // Can view all active departments
        departments = await Department.find({ status: "active" })
          .populate("companyId", "name")
          .populate("branchId", "name");
        break;

      case "Admin":
        // Can view all departments under their company
        if (!user.companyId) {
          return res.status(400).json({ message: "Admin not linked to any company" });
        }
        departments = await Department.find({
          companyId: user.companyId,
          status: "active",
        })
          .populate("companyId", "name")
          .populate("branchId", "name");
        break;

      case "BranchManager":
      case "User":
        // Can view only departments under their branch
        if (!user.branchId) {
          return res.status(400).json({ message: "User not linked to any branch" });
        }
        departments = await Department.find({
          branchId: user.branchId,
          status: "active",
        })
          .populate("companyId", "name")
          .populate("branchId", "name");
        break;

      default:
        return res.status(403).json({ message: "Invalid role or no permission" });
    }

    res.status(200).json(departments);
  } catch (err) {
    console.error("Get All Departments Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
// Get Departments by Branch
exports.getByBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const user = await User.findById(req.user?.userId)
      .populate("companyId branchId");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let allowed = false;
    let query = { branchId, status: "active" };

    switch (user.role) {
      case "SuperAdmin":
        // Can access any branch
        allowed = true;
        break;

      case "Admin":
        // Can access only branches within their company
        if (!user.companyId) {
          return res.status(400).json({ message: "Admin not linked to any company" });
        }

        const branch = await Branch.findOne({
          _id: branchId,
          companyId: user.companyId,
          status: "active",
        });

        if (!branch) {
          return res.status(404).json({ message: "Branch not found under your company" });
        }

        query.companyId = user.companyId;
        allowed = true;
        break;

      case "BranchManager":
      case "User":
        // Can access only their own branch
        if (!user.branchId || user.branchId.toString() !== branchId) {
          return res.status(403).json({ message: "Access denied for this branch" });
        }

        query.companyId = user.companyId;
        allowed = true;
        break;

      default:
        return res.status(403).json({ message: "Invalid role or no permission" });
    }

    if (!allowed) {
      return res.status(403).json({ message: "Access denied" });
    }

    const departments = await Department.find(query)
      .populate("companyId", "name")
      .populate("branchId", "name");

    res.status(200).json(departments);
  } catch (err) {
    console.error("Get Departments by Branch Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Department by ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const createdBy = req.user?.userId;
    const user = await User.findById(createdBy);
    if (!user || !user.companyId) {
      return res.status(403).json({ message: 'User or company not found' });
    }
    const companyId = user.companyId;
    const department = await Department.findOne({ _id: id, companyId });
    if (!department) {
      return res.status(404).json({ message: 'Department not found under your company' });
    }

    res.status(200).json(department);
  } catch (err) {
    console.error('Get Department by ID Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update Department
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status, branchId } = req.body;
    const createdBy = req.user?.userId;
    const user = await User.findById(createdBy);
    if (!user || !user.companyId) {
      return res.status(403).json({ message: 'User or company not found' });
    }
    const companyId = user.companyId;
    const department = await Department.findOne({ _id: id, companyId });
    if (!department) {
      return res.status(404).json({ message: 'Department not found under your company' });
    }

    const newBranchId = branchId || department.branchId;

    // Validate new branch belongs to company
    const branch = await Branch.findOne({ _id: newBranchId, companyId });
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found under your company' });
    }

    // Check for duplicate
    const duplicate = await Department.findOne({
      _id: { $ne: id },
      name: name?.trim(),
      branchId: newBranchId,
      companyId,
    });

    if (duplicate) {
      return res.status(400).json({ message: 'Another department with this name exists in this branch' });
    }

    // Update fields
    if (name) department.name = name.trim();
    if (status) department.status = status;
    department.branchId = newBranchId;

    const updated = await department.save();
    res.status(200).json({ message: 'Department updated', department: updated });

  } catch (err) {
    console.error('Update Department Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
