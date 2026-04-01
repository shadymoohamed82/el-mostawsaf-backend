const router     = require('express').Router();
const controller = require('../controllers/auth.controller');
const auth       = require('../middleware/auth');

// Public routes
router.post('/register', controller.register);
router.post('/login',    controller.login);

// Protected route
router.get('/me', auth, controller.getMe);

module.exports = router;