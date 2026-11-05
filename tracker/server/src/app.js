const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const practiceRoutes = require('./routes/practiceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const healthRoutes = require('./routes/healthRoutes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// Trust reverse proxy for secure cookies and headers in cloud deployments
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // allow CDN assets like Chart.js
}));

// CORS setup: supports ALLOWED_ORIGINS env variable or defaults to reflecting request origin
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : null;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || !allowedOrigins || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging (clean, no body secrets logged)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
}

// Actuator & Health Check
app.use('/actuator/health', healthRoutes);
app.use('/api/health', healthRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);

// Serve frontend build in production if available
const clientBuildPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));

// API 404 for unknown api routes
app.use('/api/*', notFoundHandler);

// Fallback to client SPA for non-api routes
app.get('*', (req, res, next) => {
  const indexPath = path.join(clientBuildPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // If client is not built yet, show a friendly status message
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>CodeTrack API</title><style>body{font-family:sans-serif;padding:2rem;text-align:center;}</style></head>
          <body>
            <h1>CodeTrack API is Running</h1>
            <p>Frontend client build is not yet generated. In development, run the client with <code>npm run dev</code> in /client.</p>
            <p><a href="/actuator/health">View Actuator Health</a></p>
          </body>
        </html>
      `);
    }
  });
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;
