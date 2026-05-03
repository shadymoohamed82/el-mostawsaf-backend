const { encrypt, decrypt } = require('../utils/encryption');

const getRecords = async (client, doctorId, filters = {}) => {
  const { patient_id, record_type, limit = 20, offset = 0 } = filters;

  let conditions = ['mr.doctor_id = $1', 'mr.is_deleted = FALSE'];
  let params     = [doctorId];
  let idx        = 2;

  if (patient_id) {
    conditions.push(`mr.patient_id = $${idx}`);
    params.push(patient_id);
    idx++;
  }

  if (record_type) {
    conditions.push(`mr.record_type = $${idx}`);
    params.push(record_type);
    idx++;
  }

  params.push(limit, offset);

  const sql = `
    SELECT
      mr.id, mr.record_type, mr.created_at, mr.updated_at,
      mr.diagnosis_encrypted, mr.notes_encrypted,
      u.id AS patient_id, u.full_name AS patient_name
    FROM medical_records mr
    INNER JOIN users u ON u.id = mr.patient_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY mr.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const result = await client.query(sql, params);

  // فك التشفير في الـ Backend
  return result.rows.map(r => ({
    ...r,
    diagnosis: decrypt(r.diagnosis_encrypted),
    notes:     decrypt(r.notes_encrypted),
    diagnosis_encrypted: undefined,
    notes_encrypted:     undefined,
  }));
};

const getRecordById = async (client, recordId, doctorId) => {
  const sql = `
    SELECT
      mr.id, mr.record_type, mr.created_at, mr.updated_at,
      mr.diagnosis_encrypted, mr.notes_encrypted,
      u.id AS patient_id, u.full_name AS patient_name, u.phone AS patient_phone
    FROM medical_records mr
    INNER JOIN users u ON u.id = mr.patient_id
    WHERE mr.id = $1 AND mr.doctor_id = $2 AND mr.is_deleted = FALSE
  `;

  const result = await client.query(sql, [recordId, doctorId]);
  if (!result.rows[0]) return null;

  const r = result.rows[0];
  return {
    ...r,
    diagnosis: decrypt(r.diagnosis_encrypted),
    notes:     decrypt(r.notes_encrypted),
    diagnosis_encrypted: undefined,
    notes_encrypted:     undefined,
  };
};

const createRecord = async (client, data) => {
  const { patient_id, doctor_id, record_type, diagnosis, notes } = data;

  // التشفير في الـ Backend
  const diagnosisEncrypted = encrypt(diagnosis);
  const notesEncrypted     = encrypt(notes);

  const sql = `
    INSERT INTO medical_records
      (patient_id, doctor_id, record_type, diagnosis_encrypted, notes_encrypted)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, patient_id, doctor_id, record_type, created_at
  `;

  const result = await client.query(sql, [
    patient_id, doctor_id, record_type,
    diagnosisEncrypted, notesEncrypted,
  ]);

  return result.rows[0];
};

const updateRecord = async (client, recordId, doctorId, data) => {
  const { diagnosis, notes, record_type } = data;

  const sql = `
    UPDATE medical_records
    SET
      diagnosis_encrypted = COALESCE($1, diagnosis_encrypted),
      notes_encrypted     = COALESCE($2, notes_encrypted),
      record_type         = COALESCE($3, record_type)
    WHERE id = $4 AND doctor_id = $5 AND is_deleted = FALSE
    RETURNING id, record_type, updated_at
  `;

  const result = await client.query(sql, [
    diagnosis ? encrypt(diagnosis) : null,
    notes     ? encrypt(notes)     : null,
    record_type || null,
    recordId, doctorId,
  ]);

  return result.rows[0] || null;
};

const deleteRecord = async (client, recordId, doctorId) => {
  const sql = `
    UPDATE medical_records SET is_deleted = TRUE
    WHERE id = $1 AND doctor_id = $2 AND is_deleted = FALSE
    RETURNING id
  `;
  const result = await client.query(sql, [recordId, doctorId]);
  return result.rows[0] || null;
};

const getRecordsStats = async (client, doctorId) => {
  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE record_type = 'diagnosis')    AS total_diagnoses,
      COUNT(*) FILTER (WHERE record_type = 'prescription') AS total_prescriptions,
      COUNT(*) FILTER (WHERE record_type = 'test')         AS total_tests,
      COUNT(*)                                              AS total_records
    FROM medical_records
    WHERE doctor_id = $1 AND is_deleted = FALSE
  `;
  const result = await client.query(sql, [doctorId]);
  return result.rows[0];
};

module.exports = {
  getRecords, getRecordById, createRecord,
  updateRecord, deleteRecord, getRecordsStats,
};