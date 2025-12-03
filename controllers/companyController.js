const Company = require('../models/Company');
const User = require('../models/User');
const { sendMail } = require('../utils/sendEmail');
const moment = require('moment');

exports.createCompany = async (req, res) => {
  try {
    // 1️⃣ Extract createdBy from authenticated token
    const createdBy = req.user?.userId;
    if (!createdBy)
      return res.status(400).json({ error: 'Unauthorized: Missing user info from token' });

    // 2️⃣ Support both JSON (nested) and form-data (flat)
    const isNested = typeof req.body.company === 'object' && typeof req.body.head === 'object';

    const company = isNested
      ? req.body.company
      : {
          name: req.body.company_name,
          status: req.body.company_status || 'active'
        };

    const head = isNested
      ? req.body.head
      : {
          name: req.body.head_name,
          email: req.body.head_email,
          phone: req.body.head_phone,
          password: req.body.head_password,
          role: req.body.head_role,
          empId: req.body.head_empId
        };

    // 3️⃣ Validate required fields
    if (!company?.name) return res.status(400).json({ error: 'Company name is required' });
    if (!head?.name) return res.status(400).json({ error: 'Head user name is required' });
    if (!head?.email) return res.status(400).json({ error: 'Head user email is required' });
    if (!head?.phone) return res.status(400).json({ error: 'Head user phone is required' });
    if (!head?.role) return res.status(400).json({ error: 'Head user role is required' });
    if (!head?.empId) return res.status(400).json({ error: 'Head user ID is required' });
    if (!head?.password) return res.status(400).json({ error: 'Head user password is required' });

    // 4️⃣ Check if head email already exists
    const existing = await User.findOne({ email: head.email });
    if (existing) return res.status(400).json({ error: 'Email is already registered' });

    // 5️⃣ Create head user
    const headUser = await User.create({
      name: head.name,
      empId: head.empId,
      role: head.role,
      email: head.email,
      phone: head.phone,
      password: head.password,
      createdBy: createdBy
    });

    // 6️⃣ Create company
    const newCompany = await Company.create({
      name: company.name,
      headId: headUser._id,
      createdBy: createdBy,
      status: company.status || 'active'
    });

    // 7️⃣ Link user to company
    headUser.companyId = newCompany._id;
    await headUser.save();

    // 8️⃣ Prepare email context (data for template)
    const emailContext = {
  companyName: newCompany.name,
  contactName: headUser.name,
  companyId: newCompany._id.toString(),
  shortCode: newCompany.shortCode || 'N/A',
  registeredOn: moment().format('MMMM Do YYYY, h:mm:ss a'),
  dashboardUrl: `${process.env.APP_URL}`,
  loginEmail: headUser.email,
  loginPassword: head.password,
  empId: headUser.empId,
  phone: headUser.phone,
  subject: `Welcome to Task Management - ${newCompany.name} Registered Successfully`,
  year: new Date().getFullYear()
};

    // 9️⃣ Send email (await or queue)
await sendMail(headUser.email, emailContext.subject, 'companyRegistration', emailContext);
    // 🔟 Return success response
    res.status(201).json({
      message: 'Company created successfully and email sent',
      companyId: newCompany._id,
      userId: headUser._id
    });

  } catch (err) {
    console.error('❌ Create company error:', err);
    res.status(500).json({ error: err.message });
  }
};



// GET all companies
  exports.getAllCompanies = async (req, res) => {
  try {
    const createdBy = req.user?.userId;
    const user = await User.findById(createdBy);

    if (!user) {
      return res.status(403).json({ message: 'User not found' });
    }

    let companies;

    if (user.role === 'SuperAdmin') {
      companies = await Company.find().populate('headId', 'name email phone');
    } else {
      if (!user.companyId) {
        return res.status(403).json({ message: 'User does not have a company assigned' });
      }

      companies = await Company.find({ _id: user.companyId }).populate('headId', 'name email phone');
    }

    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// GET single company by ID
exports.getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).populate('headId', 'name email phone');
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE company details (excluding head user)
exports.updateCompany = async (req, res) => {
  try {
    const name = req.body.name || req.body.company_name;
    const status = req.body.status || req.body.company_status;

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    if (name) company.name = name;
    if (status) company.status = status;

    await company.save();
    res.json({ message: 'Company updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
