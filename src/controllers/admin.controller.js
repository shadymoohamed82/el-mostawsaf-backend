const { pool, runWithRLS } = require('../config/db');
const queries              = require('../queries/admin.queries');
const { success, error }   = require('../utils/apiResponse');
const asyncHandler         = require('../middleware/asyncHandler');

// ─── Middleware: Admin Only ───────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return error(res, 'Access denied — Admin only', 403);
  }
  next();
};

// ─── GET /api/admin/stats ─────────────────────────────────────
const getStats = asyncHandler(async (req, res) => {
  const { id, role } = req.user;

  const stats = await runWithRLS(id, role, async (client) => {
    return queries.getSystemStats(client);
  });

  return success(res, {
    users: {
      doctors:  parseInt(stats.total_doctors),
      patients: parseInt(stats.total_patients),
      admins:   parseInt(stats.total_admins),
      total:    parseInt(stats.total_doctors) + parseInt(stats.total_patients) + parseInt(stats.total_admins),
    },
    appointments: {
      total:     parseInt(stats.total_appointments),
      scheduled: parseInt(stats.scheduled_appointments),
      completed: parseInt(stats.completed_appointments),
      cancelled: parseInt(stats.cancelled_appointments),
    },
    records:               parseInt(stats.total_records),
    unread_notifications:  parseInt(stats.unread_notifications),
    specializations:       parseInt(stats.total_specializations),
  });
});

// ─── GET /api/admin/users ─────────────────────────────────────
const getUsers = asyncHandler(async (req, res) => {
  const { id, role } = req.user;
  const { role: filterRole, search, limit, offset } = req.query;

  const users = await runWithRLS(id, role, async (client) => {
    return queries.getAllUsers(client, {
      role:   filterRole,
      search: search || '',
      limit:  parseInt(limit)  || 50,
      offset: parseInt(offset) || 0,
    });
  });

  const formatted = users.map(u => ({
    id:             u.id,
    name:           u.full_name,
    initial:        u.full_name.charAt(0).toUpperCase(),
    email:          u.email,
    phone:          u.phone,
    role:           u.role,
    is_active:      u.is_active,
    specialization: u.specialization || null,
    created_at:     u.created_at,
    joined:         new Date(u.created_at).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric'
                    }),
  }));

  return success(res, formatted);
});

// ─── GET /api/admin/appointments ──────────────────────────────
const getAppointments = asyncHandler(async (req, res) => {
  const { id, role } = req.user;
  const { status, date, limit, offset } = req.query;

  const appointments = await runWithRLS(id, role, async (client) => {
    return queries.getAllAppointments(client, {
      status,
      date,
      limit:  parseInt(limit)  || 50,
      offset: parseInt(offset) || 0,
    });
  });

  const formatted = appointments.map(a => ({
    id:           a.id,
    date:         new Date(a.appointment_time).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric'
                  }),
    time:         new Date(a.appointment_time).toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', hour12: true
                  }),
    appointment_time: a.appointment_time,
    duration:     a.duration_minutes,
    status:       a.status,
    notes:        a.notes || '',
    doctor:  { name: a.doctor_name,  initial: a.doctor_name.charAt(0).toUpperCase() },
    patient: { name: a.patient_name, initial: a.patient_name.charAt(0).toUpperCase(), phone: a.patient_phone },
  }));

  return success(res, formatted);
});

// ─── PATCH /api/admin/users/:id/toggle ───────────────────────
const toggleUser = asyncHandler(async (req, res) => {
  const { id: adminId, role } = req.user;
  const { id: userId }        = req.params;

  const updated = await runWithRLS(adminId, role, async (client) => {
    return queries.toggleUserActive(client, userId);
  });

  if (!updated) return error(res, 'User not found or cannot modify admin', 404);

  return success(res, updated, `User ${updated.is_active ? 'activated' : 'deactivated'} successfully`);
});

// ─── GET /api/admin/activity ──────────────────────────────────
const getActivity = asyncHandler(async (req, res) => {
  const { id, role } = req.user;

  const activity = await runWithRLS(id, role, async (client) => {
    return queries.getRecentActivity(client);
  });

  return success(res, activity);
});

module.exports = { adminOnly, getStats, getUsers, getAppointments, toggleUser, getActivity };