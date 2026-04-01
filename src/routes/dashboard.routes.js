const router     = require('express').Router();
const controller = require('../controllers/dashboard.controller');

/**
 * Dashboard Routes
 * Base: /api/dashboard
 * ─────────────────────────────────────────────────────────────
 * GET /api/dashboard/stats              → الـ 4 stat cards
 * GET /api/dashboard/patients/recent    → آخر 5 مرضى
 * GET /api/dashboard/appointments/today → مواعيد النهارده
 * GET /api/dashboard/stats/department   → department statistics
 */

router.get('/stats',                controller.getStats);
router.get('/patients/recent',      controller.getRecentPatients);
router.get('/appointments/today',   controller.getTodaysAppointments);
router.get('/stats/department',     controller.getDepartmentStats);

module.exports = router;