const { runWithRLS }     = require('../config/db');
const queries            = require('../queries/medical_records.queries');
const { success, error } = require('../utils/apiResponse');
const asyncHandler       = require('../middleware/asyncHandler');

// ─── GET /api/records ─────────────────────────────────────────
const getRecords = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;
  const { patient_id, record_type, limit, offset } = req.query;

  const records = await runWithRLS(doctorId, role, async (client) => {
    return queries.getRecords(client, doctorId, {
      patient_id,
      record_type,
      limit:  parseInt(limit)  || 20,
      offset: parseInt(offset) || 0,
    });
  });

  const formatted = records.map(r => ({
    id:           r.id,
    record_type:  r.record_type,
    diagnosis:    r.diagnosis,
    notes:        r.notes,
    created_at:   r.created_at,
    date:         new Date(r.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric'
                  }),
    patient: {
      id:      r.patient_id,
      name:    r.patient_name,
      initial: r.patient_name.charAt(0).toUpperCase(),
    },
  }));

  return success(res, formatted);
});

// ─── GET /api/records/stats ───────────────────────────────────
const getStats = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;

  const stats = await runWithRLS(doctorId, role, async (client) => {
    return queries.getRecordsStats(client, doctorId);
  });

  return success(res, {
    total_records:       parseInt(stats.total_records),
    total_diagnoses:     parseInt(stats.total_diagnoses),
    total_prescriptions: parseInt(stats.total_prescriptions),
    total_tests:         parseInt(stats.total_tests),
  });
});

// ─── GET /api/records/:id ─────────────────────────────────────
const getRecordById = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;
  const { id } = req.params;

  const record = await runWithRLS(doctorId, role, async (client) => {
    return queries.getRecordById(client, id, doctorId);
  });

  if (!record) return error(res, 'Record not found', 404);
  return success(res, record);
});

// ─── POST /api/records ────────────────────────────────────────
const createRecord = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;
  const { patient_id, record_type, diagnosis, notes } = req.body;

  if (!patient_id || !record_type) {
    return error(res, 'patient_id and record_type are required', 400);
  }

  const VALID_TYPES = ['diagnosis', 'prescription', 'test'];
  if (!VALID_TYPES.includes(record_type)) {
    return error(res, `record_type must be: ${VALID_TYPES.join(', ')}`, 400);
  }

  const record = await runWithRLS(doctorId, role, async (client) => {
    return queries.createRecord(client, {
      patient_id,
      doctor_id: doctorId,
      record_type,
      diagnosis,
      notes,
    });
  });

  return success(res, record, 'Medical record created successfully', 201);
});

// ─── PUT /api/records/:id ─────────────────────────────────────
const updateRecord = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;
  const { id } = req.params;
  const { diagnosis, notes, record_type } = req.body;

  const updated = await runWithRLS(doctorId, role, async (client) => {
    return queries.updateRecord(client, id, doctorId, {
      diagnosis, notes, record_type
    });
  });

  if (!updated) return error(res, 'Record not found', 404);
  return success(res, updated, 'Record updated successfully');
});

// ─── DELETE /api/records/:id ──────────────────────────────────
const deleteRecord = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;
  const { id } = req.params;

  const deleted = await runWithRLS(doctorId, role, async (client) => {
    return queries.deleteRecord(client, id, doctorId);
  });

  if (!deleted) return error(res, 'Record not found', 404);
  return success(res, null, 'Record deleted successfully');
});

module.exports = {
  getRecords,
  getStats,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
};