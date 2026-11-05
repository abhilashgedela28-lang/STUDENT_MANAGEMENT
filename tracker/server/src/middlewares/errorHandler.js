const config = require('../config/config');
const { PlatformError } = require('../connectors/errors');

// 404 Not Found Handler for unknown API endpoints
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
};

// Global Error Handler
const errorHandler = (err, req, res, next) => {
  // Never log passwords, tokens, or verification codes
  const safeMessage = err.message || 'Internal Server Error';

  console.error(`[Error] [${req.method} ${req.originalUrl}]:`, safeMessage);

  if (err instanceof PlatformError) {
    return res.status(502).json({
      success: false,
      errorType: err.name,
      platform: err.platform,
      message: err.message,
    });
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: messages,
    });
  }

  // Handle Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists.`,
    });
  }

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    // Do not leak stack traces to client
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
