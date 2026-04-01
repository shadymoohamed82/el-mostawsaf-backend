const router     = require('express').Router();
const controller = require('../controllers/settings.controller');

router.get   ('/profile',          controller.getProfile);
router.put   ('/profile',          controller.updateProfile);
router.get   ('/activity',         controller.getRecentActivity);
router.get   ('/specializations',  controller.getSpecializations);
router.delete('/account',          controller.deleteAccount);

module.exports = router;