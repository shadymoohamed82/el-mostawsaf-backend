const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const { pool }   = require('../config/db');
const queries    = require('../queries/auth.queries');
const { success, error } = require('../utils/apiResponse');
const asyncHandler = require('../middleware/asyncHandler');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ─── POST /api/auth/register ──────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { full_name, email, phone, password, role, specialization_id } = req.body;

  // Validation — email اختياري دلوقتي
  if (!full_name || !phone || !password || !role) {
    return error(res, 'full_name, phone, password and role are required', 400);
  }

  const VALID_ROLES = ['patient', 'doctor'];
  if (!VALID_ROLES.includes(role)) {
    return error(res, 'Role must be patient or doctor', 400);
  }

  if (password.length < 8) {
    return error(res, 'Password must be at least 8 characters', 400);
  }

  if (role === 'doctor' && !specialization_id) {
    return error(res, 'specialization_id is required for doctors', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // تأكد مش موجود
    const exists = await queries.checkUserExists(client, email, phone);
    if (exists) {
      return error(res, 'Phone or email already registered', 409);
    }

    // Hash الـ password بـ bcrypt
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await queries.createUser(client, {
      full_name,
      email:            email || null,
      phone,
      password:         hashedPassword,
      role,
      specialization_id,
    });

    await client.query('COMMIT');

    const token = generateToken(user);

    return success(res, {
      token,
      user: {
        id:    user.id,
        name:  user.full_name,
        email: user.email,
        phone: user.phone,
        role:  user.role,
      }
    }, 'Registration successful', 201);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, phone, password } = req.body;

  const emailOrPhone = email || phone;

  if (!emailOrPhone || !password) {
    return error(res, 'email or phone and password are required', 400);
  }

  const client = await pool.connect();
  try {
    const user = await queries.verifyPassword(client, emailOrPhone, password);

    if (!user) {
      return error(res, 'Invalid credentials', 401);
    }

    const token = generateToken(user);

    return success(res, {
      token,
      user: {
        id:               user.id,
        name:             user.full_name,
        email:            user.email,
        phone:            user.phone,
        role:             user.role,
        specialization_id: user.specialization_id,
      }
    }, 'Login successful');

  } finally {
    client.release();
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  return success(res, req.user);
});

module.exports = { register, login, getMe };