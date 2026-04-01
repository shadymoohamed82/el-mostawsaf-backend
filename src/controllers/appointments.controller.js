const { runWithRLS }     = require('../config/db');
const queries            = require('../queries/appointments.queries');
const notifQueries       = require('../queries/notifications.queries');
const { success, error } = require('../utils/apiResponse');
const asyncHandler       = require('../middleware/asyncHandler');

// ─── GET /api/appointments ────────────────────────────────────
const getAppointments = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;
  const { status, date, limit, offset } = req.query;

  const appointments = await runWithRLS(doctorId, role, async (client) => {
    return queries.getAppointments(client, doctorId, {
      status,
      date,
      limit:  parseInt(limit)  || 20,
      offset: parseInt(offset) || 0,
    });
  });

  const formatted = appointments.map((a) => ({
    id:           a.id,
    time:         new Date(a.appointment_time).toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', hour12: true,
                  }),
    date:         new Date(a.appointment_time).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  }),
    appointment_time: a.appointment_time,
    duration:     a.duration_minutes,
    status:       a.status,
    notes:        a.notes || '',
    patient: {
      id:      a.patient_id,
      name:    a.patient_name,
      phone:   a.patient_phone,
      initial: a.patient_name.charAt(0).toUpperCase(),
    },
  }));

  return success(res, formatted);
});

// ─── GET /api/appointments/:id ────────────────────────────────
const getAppointmentById = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;
  const { id } = req.params;

  const appointment = await runWithRLS(doctorId, role, async (client) => {
    return queries.getAppointmentById(client, id, doctorId);
  });

  if (!appointment) return error(res, 'Appointment not found', 404);
  return success(res, appointment);
});

// ─── POST /api/appointments ───────────────────────────────────
const createAppointment = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;
  const { patient_id, appointment_time, duration_minutes, notes } = req.body;

  if (!patient_id || !appointment_time) {
    return error(res, 'patient_id and appointment_time are required', 400);
  }

  const appointment = await runWithRLS(doctorId, role, async (client) => {
    // تأكد إن المريض موجود
    const patient = await queries.getPatientById(client, patient_id);
    if (!patient) {
      throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
    }

    // تأكد إن الـ slot مش محجوز
    const isAvailable = await queries.checkSlotAvailable(
      client, doctorId, appointment_time, duration_minutes || 30
    );
    if (!isAvailable) {
      throw Object.assign(
        new Error('This time slot is already booked'),
        { statusCode: 409 }
      );
    }

    // ✅ بيعمل الـ appointment والـ notifications مع بعض
    return queries.createAppointmentWithNotification(client, {
      patient_id,
      doctor_id: doctorId,
      appointment_time,
      duration_minutes,
      notes,
    }, notifQueries);
  });

  return success(res, appointment, 'Appointment created successfully', 201);
});

// ─── PATCH /api/appointments/:id ──────────────────────────────
const updateAppointment = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;
  const { id } = req.params;
  const { appointment_time, duration_minutes, notes, status } = req.body;

  const updated = await runWithRLS(doctorId, role, async (client) => {
    if (appointment_time) {
      const isAvailable = await queries.checkSlotAvailable(
        client, doctorId, appointment_time, duration_minutes || 30, parseInt(id)
      );
      if (!isAvailable) {
        throw Object.assign(
          new Error('This time slot is already booked'),
          { statusCode: 409 }
        );
      }
    }

    return queries.updateAppointment(client, id, doctorId, {
      appointment_time,
      duration_minutes,
      notes,
      status,
    });
  });

  if (!updated) return error(res, 'Appointment not found', 404);
  return success(res, updated, 'Appointment updated successfully');
});

// ─── PATCH /api/appointments/:id/status ──────────────────────
const updateStatus = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;
  const { id } = req.params;
  const { status } = req.body;

  const VALID_STATUSES = ['scheduled', 'completed', 'cancelled'];
  if (!status || !VALID_STATUSES.includes(status)) {
    return error(res, `Status must be one of: ${VALID_STATUSES.join(', ')}`, 400);
  }

  const updated = await runWithRLS(doctorId, role, async (client) => {
    return queries.updateAppointmentStatus(client, id, doctorId, status);
  });

  if (!updated) return error(res, 'Appointment not found', 404);
  return success(res, updated, `Appointment marked as ${status}`);
});

// ─── DELETE /api/appointments/:id ────────────────────────────
const cancelAppointment = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;
  const { id } = req.params;

  const cancelled = await runWithRLS(doctorId, role, async (client) => {
    return queries.cancelAppointment(client, id, doctorId);
  });

  if (!cancelled) {
    return error(res, 'Appointment not found or already cancelled', 404);
  }

  return success(res, cancelled, 'Appointment cancelled successfully');
});

module.exports = {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  updateStatus,
  cancelAppointment,
};