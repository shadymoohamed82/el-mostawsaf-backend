require('dotenv').config();
console.log('ENV TEST:', process.env.NODE_ENV); 
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { validateEnv } = require('./src/config/env');
const routes = require('./src/routes/index');
const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');

// ✅ Validate all required env variables FIRST — crash early if missing
validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ───────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:5500',
  credentials: true,
}));

// ─── Parsing & Logging ────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Health Check (قبل كل الـ routes) ────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── API Routes ───────────────────────────────────────────────────
// NOTE: كل الـ routes هتبدأ بـ /api
// الـ auth middleware هيتضاف هنا لاحقاً:
//   app.use('/api', require('./src/middleware/auth'), routes);
app.use('/api', routes);

// ─── Root Route ───────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to El-Mostawsaf API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
    },
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler (لازم يكون آخر middleware) ─────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 El-Mostawsaf API running on port ${PORT}`);
  logger.info(`📌 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;