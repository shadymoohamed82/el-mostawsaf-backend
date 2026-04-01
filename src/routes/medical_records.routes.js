const router     = require('express').Router();
const controller = require('../controllers/medical_records.controller');

router.get   ('/stats', controller.getStats);
router.get   ('/',      controller.getRecords);
router.get   ('/:id',   controller.getRecordById);
router.post  ('/',      controller.createRecord);
router.put   ('/:id',   controller.updateRecord);
router.delete('/:id',   controller.deleteRecord);

module.exports = router;