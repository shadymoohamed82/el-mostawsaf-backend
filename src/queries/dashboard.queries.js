/**
 * ═══════════════════════════════════════════════════════
 * Dashboard Queries
 * ═══════════════════════════════════════════════════════
 * كل function بتاخد (client) — يعني بتتنفذ جوا الـ RLS transaction
 * ده بيضمن إن الـ app.current_user_id set قبل أي query
 */

/**
 * ─── 1. Quick Stats Cards ────────────────────────────────────────────
 * بيرجع الـ 4 أرقام في الـ welcome card والـ stat cards:
 *   - Total unique patients للـ doctor ده
 *   - Appointments النهارده
 *   - Medical records ناقصها files (pending reports)
 *   - Critical appointments (urgent/لم تكتمل)
 */
const getDoctorStats = async (client, doctorId) => {
  const sql = `
    SELECT
      (
        SELECT COUNT(DISTINCT patient_id)
        FROM appointments
        WHERE doctor_id = $1
          AND status != 'cancelled'
      ) AS total_patients,

      (
        SELECT COUNT(*)
        FROM appointments
        WHERE doctor_id = $1
          AND appointment_time::date = CURRENT_DATE
          AND status = 'scheduled'
      ) AS todays_appointments,

      (
        SELECT COUNT(*)
        FROM medical_records mr
        WHERE mr.doctor_id = $1
          AND mr.is_deleted = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM files f WHERE f.record_id = mr.id
          )
      ) AS pending_reports,

      (
        SELECT COUNT(*)
        FROM appointments
        WHERE doctor_id = $1
          AND status = 'scheduled'
          AND appointment_time < NOW()
      ) AS critical_cases
  `;

  const result = await client.query(sql, [doctorId]);
  return result.rows[0];
};

/**
 * ─── 2. Recent Patients ──────────────────────────────────────────────
 * آخر 5 مرضى اتعاملوا مع الدكتور ده
 * بيرجع: الاسم، آخر تشخيص، آخر زيارة
 */
const getRecentPatients = async (client, doctorId) => {
  const sql = `
    SELECT DISTINCT ON (u.id)
      u.id,
      u.full_name,
      -- Latest appointment date for this patient with this doctor
      MAX(a.appointment_time) OVER (PARTITION BY u.id) AS last_visit,
      -- Latest record type as condition indicator
      (
        SELECT record_type
        FROM medical_records
        WHERE patient_id = u.id AND doctor_id = $1
          AND is_deleted = FALSE
        ORDER BY created_at DESC
        LIMIT 1
      ) AS last_record_type
    FROM users u
    INNER JOIN appointments a
      ON a.patient_id = u.id
      AND a.doctor_id = $1
    WHERE u.role = 'patient'
      AND u.is_deleted = FALSE
    ORDER BY u.id, last_visit DESC
    LIMIT 5
  `;

  // Wrap in subquery to sort by last_visit after DISTINCT ON
  const wrappedSql = `
    SELECT * FROM (${sql}) sub
    ORDER BY last_visit DESC
  `;

  const result = await client.query(wrappedSql, [doctorId]);
  return result.rows;
};

/**
 * ─── 3. Today's Appointments ─────────────────────────────────────────
 * مواعيد النهارده مع بيانات المريض
 */
const getTodaysAppointments = async (client, doctorId) => {
  const sql = `
    SELECT
      a.id,
      a.appointment_time,
      a.duration_minutes,
      a.status,
      a.notes,
      u.id        AS patient_id,
      u.full_name AS patient_name
    FROM appointments a
    INNER JOIN users u ON u.id = a.patient_id
    WHERE a.doctor_id = $1
      AND a.appointment_time::date = CURRENT_DATE
    ORDER BY a.appointment_time ASC
  `;

  const result = await client.query(sql, [doctorId]);
  return result.rows;
};
/**
 * ─── 4. Department Stats ─────────────────────────────────────────────
 * الإحصائيات الصغيرة (Recovery Rate, Avg Consultation, etc.)
 */
const getDepartmentStats = async (client, doctorId) => {
  const sql = `
    SELECT
      -- Recovery Rate: completed / total (non-cancelled) * 100
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'completed')
               / NULLIF(COUNT(*) FILTER (WHERE status != 'cancelled'), 0),
        1
      ) AS recovery_rate,

      -- Average consultation duration (minutes)
      ROUND(
        AVG(duration_minutes) FILTER (WHERE status = 'completed'),
        0
      ) AS avg_consultation_minutes,

      -- Total appointments this month
      COUNT(*) FILTER (
        WHERE DATE_TRUNC('month', appointment_time) = DATE_TRUNC('month', NOW())
      ) AS this_month_appointments,

      -- Total appointments last month (for growth %)
      COUNT(*) FILTER (
        WHERE DATE_TRUNC('month', appointment_time) 
              = DATE_TRUNC('month', NOW() - INTERVAL '1 month')
      ) AS last_month_appointments

    FROM appointments
    WHERE doctor_id = $1
  `;

  const result = await client.query(sql, [doctorId]);
  const row = result.rows[0];

  // Calculate monthly growth %
  const thisMonth = parseInt(row.this_month_appointments) || 0;
  const lastMonth = parseInt(row.last_month_appointments) || 0;
  const monthlyGrowth = lastMonth > 0
    ? (((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1)
    : null;

  return {
    recovery_rate:            parseFloat(row.recovery_rate) || 0,
    avg_consultation_minutes: parseInt(row.avg_consultation_minutes) || 0,
    monthly_growth_percent:   monthlyGrowth,
    patient_satisfaction:     92, // static لحد ما يتضاف rating system
  };
};

module.exports = {
  getDoctorStats,
  getRecentPatients,
  getTodaysAppointments,
  getDepartmentStats,
};