const REQUIRED_ENV = [
  'JWT_SECRET',
  'DB_ENCRYPTION_KEY',
  'NODE_ENV',
];

function validateEnv() {
  // لو في DATABASE_URL مش محتاج الـ DB vars
  if (!process.env.DATABASE_URL) {
    REQUIRED_ENV.push('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD');
  }

  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables:\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }
}

module.exports = { validateEnv };