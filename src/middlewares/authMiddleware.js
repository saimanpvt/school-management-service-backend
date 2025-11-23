const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HTTP_STATUS, MESSAGES } = require('../config/constants');

const authMiddleware = async (req, res, next) => {
  try {
    let token;

    // From header
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // From cookies
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.UNAUTHORIZED + ': No token provided'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.UNAUTHORIZED + ': Invalid token'
      });
    }

    // Fetch full user using internal _id
    const user = await User.findById(decoded._id).select('-password -__v -createdAt -updatedAt');

    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.UNAUTHORIZED + ': User not found'
      });
    }

    if (!user.isActive) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.UNAUTHORIZED + ': Account is deactivated'
      });
    }

    // Attach user to req
    req.user = {
      _id: user._id,              // internal unique ID
      userID: user.userID,        // public registration ID
      email: user.email,
      role: decoded.role,                  // Number from token
      roleName: ROLE_NAMES[decoded.role]   // String for convenience
    };

    next();
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  }
};

module.exports = authMiddleware;