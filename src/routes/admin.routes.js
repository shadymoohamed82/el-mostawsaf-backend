const router     = require('express').Router();
const controller = require('../controllers/admin.controller');

// كل الـ routes دي محتاجة Admin role
router.use(controller.adminOnly);

router.get  ('/stats',              controller.getStats);
router.get  ('/users',              controller.getUsers);
router.get  ('/appointments',       controller.getAppointments);
router.patch('/users/:id/toggle',   controller.toggleUser);
router.get  ('/activity',           controller.getActivity);

module.exports = router;