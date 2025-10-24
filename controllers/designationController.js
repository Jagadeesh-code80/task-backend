const mongoose = require('mongoose');
const Designation = require('../models/Designation');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Department = require('../models/Department');

// Create Designation
exports.createDesignation = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is missing or invalid' });
    }

    const { name, status = 'active', branchId, departmentId } = req.body;

    if (!name || !branchId || !departmentId) {
      return res.status(400).json({ message: 'Name, branch ID, and department ID are required' });
    }

    const createdBy = req.user?.userId;
    const user = await User.findById(createdBy);
    if (!user || !user.companyId) {
      return res.status(403).json({ message: 'User or company not found' });
    }
    const companyId = user.companyId;

    const branch = await Branch.findOne({ _id: branchId, companyId });
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found under your company' });
    }

    const department = await Department.findOne({ _id: departmentId, branchId, companyId });
    if (!department) {
      return res.status(404).json({ message: 'Department not found in this branch and company' });
    }

    const duplicate = await Designation.findOne({
      name: name.trim(),
      branchId,
      departmentId,
      companyId,
    });

    if (duplicate) {
      return res.status(400).json({ message: 'Designation already exists in this department' });
    }

    const designation = await Designation.create({
      name: name.trim(),
      status,
      branchId,
      departmentId,
      companyId,
      createdBy,
    });

    res.status(201).json({ message: 'Designation created successfully', designation });

  } catch (err) {
    console.error('Create Designation Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Get All Designations
exports.getAllDesignations = async (req, res) => {
  try {
    const user = await User.findById(req.user?.userId)
      .populate("companyId branchId");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let designations = [];

    switch (user.role) {
      case "SuperAdmin":
        // View all designations
        designations = await Designation.find({ status: "active" })
          .populate("companyId", "name")
          .populate("branchId", "name")
          .populate("departmentId", "name");
        break;

      case "Admin":
        // View all designations under company
        if (!user.companyId) {
          return res.status(400).json({ message: "Admin not linked to any company" });
        }

        designations = await Designation.find({
          companyId: user.companyId,
          status: "active",
        })
          .populate("companyId", "name")
          .populate("branchId", "name")
          .populate("departmentId", "name");
        break;

      case "BranchManager":
      case "User":
        // View designations under own branch
        if (!user.branchId) {
          return res.status(400).json({ message: "User not linked to any branch" });
        }

        designations = await Designation.find({
          branchId: user.branchId,
          status: "active",
        })
          .populate("companyId", "name")
          .populate("branchId", "name")
          .populate("departmentId", "name");
        break;

      default:
        return res.status(403).json({ message: "Invalid role or no permission" });
    }

    res.status(200).json(designations);
  } catch (err) {
    console.error("Get All Designations Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};


// Get Designations by Department ID
exports.getDesignationsByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;

    if (!departmentId) {
      return res.status(400).json({ message: "Department ID is required" });
    }

    const user = await User.findById(req.user?.userId)
      .populate("companyId branchId");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let query = { departmentId, status: "active" };

    switch (user.role) {
      case "SuperAdmin":
        // No company restriction
        break;

      case "Admin":
        if (!user.companyId) {
          return res.status(400).json({ message: "Admin not linked to any company" });
        }
        query.companyId = user.companyId;
        break;

      case "BranchManager":
      case "User":
        if (!user.branchId) {
          return res.status(400).json({ message: "User not linked to any branch" });
        }

        query.branchId = user.branchId;
        query.companyId = user.companyId;
        break;

      default:
        return res.status(403).json({ message: "Invalid role or no permission" });
    }

    const designations = await Designation.find(query)
      .populate("companyId", "name")
      .populate("branchId", "name")
      .populate("departmentId", "name");

    res.status(200).json(designations);
  } catch (err) {
    console.error("Get Designations by Department Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Designation by ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const createdBy = req.user?.userId;
    const user = await User.findById(createdBy);
    if (!user || !user.companyId) {
      return res.status(403).json({ message: 'User or company not found' });
    }
    const companyId = user.companyId;

    const designation = await Designation.findOne({ _id: id, companyId })
      .populate('branchId', 'name')
      .populate('departmentId', 'name');

    if (!designation) {
      return res.status(404).json({ message: 'Designation not found under your company' });
    }

    res.status(200).json(designation);
  } catch (err) {
    console.error('Get Designation by ID Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update Designation
exports.updateDesignation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status, branchId, departmentId } = req.body;

    const createdBy = req.user?.userId;
    const user = await User.findById(createdBy);
    if (!user || !user.companyId) {
      return res.status(403).json({ message: 'User or company not found' });
    }
    const companyId = user.companyId;

    const designation = await Designation.findOne({ _id: id, companyId });
    if (!designation) {
      return res.status(404).json({ message: 'Designation not found under your company' });
    }

    const newBranchId = branchId || designation.branchId;
    const newDepartmentId = departmentId || designation.departmentId;

    const branch = await Branch.findOne({ _id: newBranchId, companyId });
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found under your company' });
    }

    const department = await Department.findOne({ _id: newDepartmentId, branchId: newBranchId, companyId });
    if (!department) {
      return res.status(404).json({ message: 'Department not found in this branch and company' });
    }

    const duplicate = await Designation.findOne({
      _id: { $ne: id },
      name: name?.trim(),
      branchId: newBranchId,
      departmentId: newDepartmentId,
      companyId,
    });

    if (duplicate) {
      return res.status(400).json({ message: 'Another designation with this name exists in this department' });
    }

    if (name) designation.name = name.trim();
    if (status) designation.status = status;
    designation.branchId = newBranchId;
    designation.departmentId = newDepartmentId;

    const updated = await designation.save();
    res.status(200).json({ message: 'Designation updated', designation: updated });

  } catch (err) {
    console.error('Update Designation Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
