/**
 * ═══════════════════════════════════════════════════════
 * Appointments Queries
 * ═══════════════════════════════════════════════════════
 */

// ─── 1. Get All Appointments (with filters) ───────────────────────
const getAppointments = async (client, doctorId, filters = {}) => {
  const { status, date, limit = 20, offset = 0 } = filters;

  let conditions = ['a.doctor_id = $1'];
  let params     = [doctorId];
  let paramIndex = 2;

  if (status) {
    conditions.push(`a.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (date) {
    conditions.push(`a.appointment_time::date = $${paramIndex}`);
    params.push(date);
    paramIndex++;
  }

  params.push(limit, offset);

  const sql = `
    SELECT
      a.id,
      a.appointment_time,
      a.duration_minutes,
      a.status,
      a.notes,
      a.created_at,
      u.id        AS patient_id,
      u.full_name AS patient_name,
      u.phone     AS patient_phone
    FROM appointments a
    INNER JOIN users u ON u.id = a.patient_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.appointment_time ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const result = await client.query(sql, params);
  return result.rows;
};

// ─── 2. Get Single Appointment ────────────────────────────────────
const getAppointmentById = async (client, appointmentId, doctorId) => {
  const sql = `
    SELECT
      a.id,
      a.appointment_time,
      a.duration_minutes,
      a.status,
      a.notes,
      a.created_at,
      u.id        AS patient_id,
      u.full_name AS patient_name,
      u.phone     AS patient_phone,
      u.email     AS patient_email
    FROM appointments a
    INNER JOIN users u ON u.id = a.patient_id
    WHERE a.id        = $1
      AND a.doctor_id = $2
  `;

  const result = await client.query(sql, [appointmentId, doctorId]);
  return result.rows[0] || null;
};

// ─── 3. Create Appointment ────────────────────────────────────────
const createAppointment = async (client, data) => {
  const { patient_id, doctor_id, appointment_time, duration_minutes = 30, notes } = data;

  const sql = `
    INSERT INTO appointments
      (patient_id, doctor_id, appointment_time, duration_minutes, notes, status)
    VALUES
      ($1, $2, $3, $4, $5, 'scheduled')
    RETURNING *
  `;

  const result = await client.query(sql, [
    patient_id,
    doctor_id,
    appointment_time,
    duration_minutes,
    notes || null,
  ]);

  return result.rows[0];
};

// ─── 4. Update Appointment Status ─────────────────────────────────
const updateAppointmentStatus = async (client, appointmentId, doctorId, status) => {
  const sql = `
    UPDATE appointments
    SET    status = $1
    WHERE  id        = $2
      AND  doctor_id = $3
    RETURNING *
  `;

  const result = await client.query(sql, [status, appointmentId, doctorId]);
  return result.rows[0] || null;
};

// ─── 5. Update Appointment Details ────────────────────────────────
const updateAppointment = async (client, appointmentId, doctorId, data) => {
  const { appointment_time, duration_minutes, notes, status } = data;

  const sql = `
    UPDATE appointments
    SET
      appointment_time = COALESCE($1, appointment_time),
      duration_minutes = COALESCE($2, duration_minutes),
      notes            = COALESCE($3, notes),
      status           = COALESCE($4, status)
    WHERE id        = $5
      AND doctor_id = $6
    RETURNING *
  `;

  const result = await client.query(sql, [
    appointment_time || null,
    duration_minutes || null,
    notes            || null,
    status           || null,
    appointmentId,
    doctorId,
  ]);

  return result.rows[0] || null;
};

// ─── 6. Cancel Appointment ────────────────────────────────────────
const cancelAppointment = async (client, appointmentId, doctorId) => {
  const sql = `
    UPDATE appointments
    SET    status = 'cancelled'
    WHERE  id        = $1
      AND  doctor_id = $2
      AND  status    = 'scheduled'
    RETURNING *
  `;

  const result = await client.query(sql, [appointmentId, doctorId]);
  return result.rows[0] || null;
};

// ─── 7. Check Patient Exists ──────────────────────────────────────
const getPatientById = async (client, patientId) => {
  const sql = `
    SELECT id, full_name, email, phone
    FROM   users
    WHERE  id         = $1
      AND  role       = 'patient'
      AND  is_deleted = FALSE
  `;

  const result = await client.query(sql, [patientId]);
  return result.rows[0] || null;
};

// ─── 8. Check Doctor Availability ────────────────────────────────
const checkSlotAvailable = async (client, doctorId, appointmentTime, durationMinutes = 30, excludeId = null) => {
  const sql = `
    SELECT id FROM appointments
    WHERE  doctor_id = $1
      AND  status   != 'cancelled'
      AND  id        != COALESCE($4, -1)
      AND  tsrange(
             appointment_time,
             appointment_time + (duration_minutes || ' minutes')::interval
           )
           &&
           tsrange(
             $2::timestamp,
             $2::timestamp + ($3 || ' minutes')::interval
           )
  `;

  const result = await client.query(sql, [
    doctorId,
    appointmentTime,
    durationMinutes,
    excludeId,
  ]);

  return result.rows.length === 0; // true = available
};

module.exports = {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  cancelAppointment,
  getPatientById,
  checkSlotAvailable,
};
// أضف الـ function دي في الآخر
const createAppointmentWithNotification = async (client, data, notifQueries) => {
  const appointment = await createAppointment(client, data);

  // إشعار للدكتور
  await notifQueries.createNotification(
    client,
    data.doctor_id,
    `New appointment booked by patient on ${new Date(data.appointment_time)
      .toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      })}`
  );

  // إشعار للمريض
  await notifQueries.createNotification(
    client,
    data.patient_id,
    `Your appointment has been confirmed for ${new Date(data.appointment_time)
      .toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      })}`
  );

  return appointment;
};

module.exports = {
  getAppointments,
  getAppointmentById,
  createAppointment,
  createAppointmentWithNotification, // ✅ الجديد
  updateAppointment,
  updateAppointmentStatus,
  cancelAppointment,
  getPatientById,
  checkSlotAvailable,
};