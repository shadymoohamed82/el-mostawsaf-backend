const { runWithRLS }  = require('../config/db');
const queries         = require('../queries/dashboard.queries');
const { success }     = require('../utils/apiResponse');
const asyncHandler    = require('../middleware/asyncHandler');

/**
 * ─── Helper: format last_visit to human-readable ─────────────────────
 */
function formatLastVisit(timestamp) {
  if (!timestamp) return 'No visits yet';

  const now      = new Date();
  const visit    = new Date(timestamp);
  const diffMs   = now - visit;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7)   return `${diffDays} days ago`;
  if (diffDays < 14)  return '1 week ago';
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

/**
 * GET /api/dashboard/stats
 * ─────────────────────────────────────────────────────────────────────
 * بيرجع الـ 4 stat cards:
 * total_patients, todays_appointments, pending_reports, critical_cases
 */
const getStats = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;

  const stats = await runWithRLS(doctorId, role, async (client) => {
    return queries.getDoctorStats(client, doctorId);
  });

  return success(res, {
    total_patients:       parseInt(stats.total_patients),
    todays_appointments:  parseInt(stats.todays_appointments),
    pending_reports:      parseInt(stats.pending_reports),
    critical_cases:       parseInt(stats.critical_cases),
  });
});

/**
 * GET /api/dashboard/patients/recent
 * ─────────────────────────────────────────────────────────────────────
 * آخر 5 مرضى مع الـ status badge
 */
const getRecentPatients = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;

  const patients = await runWithRLS(doctorId, role, async (client) => {
    return queries.getRecentPatients(client, doctorId);
  });

  // Map لـ frontend format
  const formatted = patients.map((p) => ({
    id:         p.id,
    name:       p.full_name,
    initial:    p.full_name.charAt(0).toUpperCase(),
    condition:  p.last_record_type || 'General',
    last_visit: formatLastVisit(p.last_visit),
    // Status logic: لو مفيش records = review، لو آخر appointment overdue = critical
    status:     p.last_record_type === 'diagnosis' ? 'stable' : 'review',
  }));

  return success(res, formatted);
});

/**
 * GET /api/dashboard/appointments/today
 * ─────────────────────────────────────────────────────────────────────
 * مواعيد النهارده مع badge الـ status
 */
const getTodaysAppointments = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;

  const appointments = await runWithRLS(doctorId, role, async (client) => {
    return queries.getTodaysAppointments(client, doctorId);
  });

  const formatted = appointments.map((a) => ({
    id:           a.id,
    time:         new Date(a.appointment_time).toLocaleTimeString('en-US', {
                    hour:   '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  }),
    patient_name: a.patient_name,
    patient_id:   a.patient_id,
    initial:      a.patient_name.charAt(0).toUpperCase(),
    notes:        a.notes || '',
    duration:     a.duration_minutes,
    // Map DB status → frontend badge
    badge: {
      scheduled:  'confirmed',
      completed:  'stable',
      cancelled:  'cancelled',
    }[a.status] || 'pending',
  }));

  return success(res, formatted);
});

/**
 * GET /api/dashboard/stats/department
 * ─────────────────────────────────────────────────────────────────────
 * الكروت الصغيرة: Recovery Rate, Avg Consultation, Growth, Satisfaction
 */
const getDepartmentStats = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;

  const stats = await runWithRLS(doctorId, role, async (client) => {
    return queries.getDepartmentStats(client, doctorId);
  });

  return success(res, stats);
});

module.exports = {
  getStats,
  getRecentPatients,
  getTodaysAppointments,
  getDepartmentStats,
};