const REQUIRED_ENV = [
  'DB_HOST',
  'DB_PORT', 
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DB_ENCRYPTION_KEY',
  'JWT_SECRET',          // جاهز للـ Auth لاحقاً
  'NODE_ENV',
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables:\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }
}

module.exports = { validateEnv };