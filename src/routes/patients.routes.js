const router     = require('express').Router();
const controller = require('../controllers/patients.controller');

router.get('/',    controller.getPatients);
router.get('/:id', controller.getPatientDetails);

module.exports = router;