const router     = require('express').Router();
const controller = require('../controllers/patients.controller');

router.get('/',    controller.getPatients);
router.get('/:id', controller.getPatientDetails);
router.get('/:id/summary', controller.getPatientSummary);
module.exports = router;