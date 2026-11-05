const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');

const requireAuth = async (req, res, next) => {
  try {
    let token = null;

    // Check Authorization header or cookies
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to continue.',
      });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Resilient lookup with 1-retry on transient network drop
    let user;
    try {
      user = await User.findById(decoded.id).select('-password');
    } catch (dbErr) {
      if (dbErr.name === 'MongoNetworkError' || dbErr.message?.includes('ECONNRESET')) {
        await new Promise(r => setTimeout(r, 400));
        user = await User.findById(decoded.id).select('-password');
      } else {
        throw dbErr;
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session. Please log in again.',
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Administrator privileges required.',
    });
  }
  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
};
