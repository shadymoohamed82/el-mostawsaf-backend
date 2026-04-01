const { pool }           = require('../config/db');
const queries            = require('../queries/doctors.queries');
const notifQueries       = require('../queries/notifications.queries');
const { success, error } = require('../utils/apiResponse');
const asyncHandler       = require('../middleware/asyncHandler');

// ─── GET /api/doctors ─────────────────────────────────────────
const getDoctors = asyncHandler(async (req, res) => {
  const { specialization_id, search } = req.query;

  const client = await pool.connect();
  try {
    const doctors = await queries.getDoctors(client, { specialization_id, search });

    const formatted = doctors.map(d => ({
      id:              d.id,
      name:            d.full_name,
      initial:         d.full_name.charAt(0).toUpperCase(),
      phone:           d.phone,
      specialization:  d.specialization || 'General',
      specialization_id: d.specialization_id,
      total_completed: parseInt(d.total_completed) || 0,
      todays_count:    parseInt(d.todays_count)    || 0,
    }));

    return success(res, formatted);
  } finally {
    client.release();
  }
});

// ─── GET /api/doctors/specializations ────────────────────────
const getSpecializations = asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    const specs = await queries.getAllSpecializations(client);
    return success(res, specs);
  } finally {
    client.release();
  }
});

// ─── GET /api/doctors/:id ─────────────────────────────────────
const getDoctorById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    const doctor = await queries.getDoctorById(client, id);
    if (!doctor) return error(res, 'Doctor not found', 404);
    return success(res, doctor);
  } finally {
    client.release();
  }
});

// ─── GET /api/doctors/:id/slots?date=2026-03-28 ───────────────
const getDoctorSlots = asyncHandler(async (req, res) => {
  const { id }   = req.params;
  const { date } = req.query;

  if (!date) return error(res, 'date query param is required (YYYY-MM-DD)', 400);

  const client = await pool.connect();
  try {
    // تأكد إن الدكتور موجود
    const doctor = await queries.getDoctorById(client, id);
    if (!doctor) return error(res, 'Doctor not found', 404);

    const slots = await queries.getDoctorAvailableSlots(client, id, date);
    return success(res, { doctor, date, slots });
  } finally {
    client.release();
  }
});

module.exports = { getDoctors, getDoctorById, getDoctorSlots, getSpecializations };