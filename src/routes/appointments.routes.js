const router     = require('express').Router();
const controller = require('../controllers/appointments.controller');

/**
 * Appointments Routes
 * Base: /api/appointments
 * ─────────────────────────────────────────────────────────────
 * GET    /api/appointments              → كل المواعيد (مع filters)
 * GET    /api/appointments/:id          → موعد واحد
 * POST   /api/appointments              → إنشاء موعد جديد
 * PATCH  /api/appointments/:id          → تعديل موعد
 * PATCH  /api/appointments/:id/status   → تغيير الـ status
 * DELETE /api/appointments/:id          → إلغاء موعد
 */

router.get   ('/',              controller.getAppointments);
router.get   ('/:id',          controller.getAppointmentById);
router.post  ('/',              controller.createAppointment);
router.patch ('/:id',          controller.updateAppointment);
router.patch ('/:id/status',   controller.updateStatus);
router.delete('/:id',          controller.cancelAppointment);

module.exports = router;