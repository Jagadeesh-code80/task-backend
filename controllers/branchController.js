const Branch = require('../models/Branch');
const User = require('../models/User');

// Create Branch (Only by company_head)
exports.createBranch = async (req, res) => {
  try {
    const createdBy = req.user?.userId;
    if (!createdBy)
      return res.status(400).json({ message: "Unauthorized: Missing user info from token" });

    const currentUser = await User.findById(createdBy);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Only SuperAdmin or Admin can create branches
    if (!["SuperAdmin", "Admin"].includes(currentUser.role)) {
      return res.status(403).json({ message: "Only Admin or SuperAdmin can create branches" });
    }

    const { name, code, status } = req.body;
    if (!name || !code) {
      return res.status(400).json({ message: "Branch name and code are required" });
    }

    // ✅ Ensure companyId exists
    if (!currentUser.companyId) {
      return res.status(400).json({ message: "User is not linked to any company" });
    }

    // ✅ Check if branch name or code already exists under the same company
    const existingBranch = await Branch.findOne({
      companyId: currentUser.companyId,
      $or: [{ name: name.trim() }, { code: code.trim() }],
    });

    if (existingBranch) {
      const duplicateField =
        existingBranch.name.toLowerCase() === name.trim().toLowerCase()
          ? "name"
          : "code";
      return res
        .status(400)
        .json({ message: `Branch ${duplicateField} already exists under this company` });
    }

    // ✅ Create new branch
    const newBranch = await Branch.create({
      name: name.trim(),
      code: code.trim(),
      status: status || "active",
      companyId: currentUser.companyId,
      createdBy,
    });

    res.status(201).json({
      message: "Branch created successfully",
      branch: newBranch,
    });
  } catch (err) {
    console.error("Create branch error:", err);
    res.status(500).json({ error: err.message });
  }
};


// Get All Branches (Only from user's company)
exports.getAllBranches = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    let branches;

    switch (user.role) {
      case "SuperAdmin":
        // Can see all active branches
        branches = await Branch.find({ status: "active" }).populate("companyId");
        break;

      case "Admin":
        // Can see all branches within their company
        if (!user.companyId)
          return res.status(400).json({ error: "Admin not linked to any company" });

        branches = await Branch.find({
          companyId: user.companyId,
          status: "active",
        }).populate("companyId");
        break;

      case "BranchManager":
      case "User":
        // Can see only their branch
        if (!user.branchId)
          return res.status(400).json({ error: "User not linked to any branch" });

        branches = await Branch.find({
          _id: user.branchId,
          status: "active",
        }).populate("companyId");
        break;

      default:
        return res.status(403).json({ error: "Invalid role or no permission" });
    }

    res.status(200).json(branches);
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
    const { id } = req.params;
    const { name, code, status } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const branch = await Branch.findById(id);
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    // ✅ Only SuperAdmin or Admin can update
    if (!["SuperAdmin", "Admin"].includes(user.role)) {
      return res.status(403).json({ message: "Unauthorized: Only Admin or SuperAdmin can update branches" });
    }

    // ✅ Admin can only update branches under their company
    if (user.role === "Admin" && branch.companyId.toString() !== user.companyId.toString()) {
      return res.status(403).json({ message: "You are not authorized to update this branch" });
    }

    // ✅ Check for duplicate branch name or code under same company (excluding self)
    if (name || code) {
      const existingBranch = await Branch.findOne({
        companyId: branch.companyId,
        _id: { $ne: branch._id },
        $or: [
          name ? { name: name.trim() } : {},
          code ? { code: code.trim() } : {},
        ],
      });

      if (existingBranch) {
        const duplicateField =
          existingBranch.name.toLowerCase() === name?.trim().toLowerCase()
            ? "name"
            : "code";
        return res.status(400).json({
          message: `Branch ${duplicateField} already exists under this company`,
        });
      }
    }

    // ✅ Perform update safely
    const updatedBranch = await Branch.findByIdAndUpdate(
      id,
      {
        ...(name && { name: name.trim() }),
        ...(code && { code: code.trim() }),
        ...(status && { status }),
        updatedAt: new Date(),
      },
      { new: true }
    );

    res.status(200).json({
      message: "Branch updated successfully",
      branch: updatedBranch,
    });
  } catch (err) {
    console.error("Update branch error:", err);
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
