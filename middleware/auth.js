const jwt = require('jsonwebtoken');
require('dotenv').config();

// Authentication Middleware
exports.authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role, name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Admin-only Middleware
exports.requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Access denied: Admins only' });
  }
  next();
};

exports.requireCompanyHead = (req, res, next) => {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied: Only company head can perform this action' });
  }
  next();
};
