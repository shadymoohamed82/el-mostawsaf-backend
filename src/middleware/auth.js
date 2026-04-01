const jwt = require('jsonwebtoken');
const { error } = require('../utils/apiResponse');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token      = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return error(res, 'Access denied — no token provided', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id:    decoded.id,
      role:  decoded.role,
      email: decoded.email,
    };
    next();
  } catch (err) {
    return error(res, 'Invalid or expired token', 403);
  }
}

module.exports = authMiddleware;