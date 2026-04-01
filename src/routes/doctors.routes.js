const router     = require('express').Router();
const controller = require('../controllers/doctors.controller');

/**
 * Doctors Routes — Public (المريض يشوفها بدون login)
 * Base: /api/doctors
 * ─────────────────────────────────────────────────────
 * GET /api/doctors                    → قائمة الدكاترة
 * GET /api/doctors/specializations    → التخصصات
 * GET /api/doctors/:id                → دكتور واحد
 * GET /api/doctors/:id/slots?date=    → المواعيد الفاضية
 */

router.get('/',                    controller.getDoctors);
router.get('/specializations',     controller.getSpecializations);
router.get('/:id',                 controller.getDoctorById);
router.get('/:id/slots',           controller.getDoctorSlots);

module.exports = router;