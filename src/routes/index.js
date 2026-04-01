const router = require('express').Router();
const auth   = require('../middleware/auth');
const rls    = require('../middleware/rls');

// ─── Public Routes ────────────────────────────────────────────
router.use('/auth',    require('./auth.routes'));
router.use('/doctors', require('./doctors.routes')); // ✅ public لصاحبك

// ─── Protected Routes ─────────────────────────────────────────
router.use('/dashboard',     auth, rls, require('./dashboard.routes'));
router.use('/appointments',  auth, rls, require('./appointments.routes'));
router.use('/patients',      auth, rls, require('./patients.routes'));
router.use('/settings',      auth, rls, require('./settings.routes'));
router.use('/notifications', auth, rls, require('./notifications.routes'));

module.exports = router;