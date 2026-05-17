const router = require('express').Router();
const auth   = require('../middleware/auth');
const rls    = require('../middleware/rls');

// ─── Public ───────────────────────────────────────────────────
router.use('/auth',    require('./auth.routes'));
router.use('/doctors', require('./doctors.routes'));

// ⚠️ السطر ده هو اللي بيربط الملف الجديد.. اتأكد إنه موجود ومكتوب كده بالظبط:
router.use('/', require('./ai.routes')); 

// ─── Protected ────────────────────────────────────────────────
router.use('/dashboard',    auth, rls, require('./dashboard.routes'));
router.use('/appointments',  auth, rls, require('./appointments.routes'));
router.use('/patients',      auth, rls, require('./patients.routes'));
router.use('/settings',      auth, rls, require('./settings.routes'));
router.use('/notifications', auth, rls, require('./notifications.routes'));
router.use('/records',       auth, rls, require('./medical_records.routes'));

module.exports = router;