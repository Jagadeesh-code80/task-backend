const Project = require('../models/Project');
const User = require('../models/User');

// Create Project
exports.createProject = async (req, res) => {
  try {
    const createdBy = req.user?.userId;
    const user = await User.findById(createdBy);
    console.log(user)

    if (!user || !user.companyId) {
      return res.status(403).json({ message: 'Invalid user or missing company/branch details' });
    }

    // Only allow Admin and BranchManager
    if (!['Admin', 'BranchManager'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied: Only Admin and BranchManager can create projects' });
    }

    const {
      name,
      description,
      startDate,
      endDate,
      priority,
      status,
      progress,
      teamLeadId,
      managerId,
      branchId,
      assignedEmployees,
      departmentIds, // now supports multiple
      technologies,
      attachments
    } = req.body;

    const newProject = new Project({
      name,
      description,
      startDate,
      endDate,
      priority,
      status,
      progress,
      teamLeadId,
      managerId,
      assignedEmployees,
      companyId: user.companyId,
      branchId: branchId,
      departmentIds,
      technologies,
      attachments,
      createdBy
    });

    await newProject.save();

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project: newProject
    });

  } catch (error) {
    console.error('Create Project Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get All Projects - Role-based Access
exports.getAllProjects = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId);

    if (!user || !user.role) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    let filter = {};

    if (user.role === 'Admin') {
      filter.companyId = user.companyId;
    } else if (user.role === 'BranchManager') {
      filter.branchId = user.branchId;
    } else {
      filter.$or = [
        { teamLeadId: userId },
        { managerId: userId },
        { assignedEmployees: userId }
      ];
    }

    const projects = await Project.find(filter)
      .populate('teamLeadId', 'name email avatar')
      .populate('managerId', 'name email avatar')
      .populate('assignedEmployees', 'name email avatar')
      .populate('companyId', 'name')
      .populate('branchId', 'name')
      .populate('departmentIds', 'name')
      .populate('createdBy', 'name email avatar')
      .populate('lastUpdatedBy', 'name email avatar');

    res.status(200).json({ count: projects.length, projects });
  } catch (err) {
    console.error('Get All Projects Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get Single Project by ID
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('teamLeadId', 'name email avatar')
      .populate('managerId', 'name email avatar')
      .populate('assignedEmployees', 'name email avatar')
      .populate('companyId', 'name')
      .populate('branchId', 'name')
      .populate('departmentIds', 'name')
      .populate('createdBy', 'name email avatar')
      .populate('lastUpdatedBy', 'name email avatar');

    if (!project) return res.status(404).json({ message: 'Project not found' });

    res.status(200).json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Project
exports.updateProject = async (req, res) => {
  try {
    const lastUpdatedBy = req.user?.userId;

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastUpdatedBy },
      { new: true, runValidators: true }
    );

    if (!updatedProject) return res.status(404).json({ message: 'Project not found' });

    res.status(200).json({ message: 'Project updated successfully', project: updatedProject });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete Project
exports.deleteProject = async (req, res) => {
  try {
    const deleted = await Project.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Project not found' });

    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
