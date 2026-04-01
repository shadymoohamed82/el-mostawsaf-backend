const router     = require('express').Router();
const controller = require('../controllers/notifications.controller');

router.get  ('/',                controller.getNotifications);
router.patch('/:notifId/read',   controller.markAsRead);
router.patch('/read-all',        controller.markAllAsRead);

module.exports = router;