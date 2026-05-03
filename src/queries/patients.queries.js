const { decrypt } = require('../utils/encryption');

const getPatientSummary = async (client, patientId) => {
  const patientSql = `
    SELECT id, full_name, phone, email,
      EXTRACT(YEAR FROM AGE(date_of_birth)) AS age
    FROM users
    WHERE id = $1 AND role = 'patient' AND is_deleted = FALSE
  `;

  const apptSql = `
    SELECT a.appointment_time, a.status, a.notes,
      u.full_name AS doctor_name, s.name AS specialization
    FROM appointments a
    INNER JOIN users u ON u.id = a.doctor_id
    LEFT JOIN specializations s ON s.id = u.specialization_id
    WHERE a.patient_id = $1
    ORDER BY a.appointment_time DESC LIMIT 5
  `;

  const recordsSql = `
    SELECT mr.record_type, mr.created_at,
      mr.diagnosis_encrypted, mr.notes_encrypted,
      u.full_name AS doctor_name
    FROM medical_records mr
    INNER JOIN users u ON u.id = mr.doctor_id
    WHERE mr.patient_id = $1 AND mr.is_deleted = FALSE
    ORDER BY mr.created_at DESC LIMIT 5
  `;

  const [patient, appointments, records] = await Promise.all([
    client.query(patientSql,  [patientId]),
    client.query(apptSql,     [patientId]),
    client.query(recordsSql,  [patientId]),
  ]);

  if (!patient.rows[0]) return null;

  return {
    patient:           patient.rows[0],
    last_appointments: appointments.rows,
    medical_records:   records.rows.map(r => ({
      ...r,
      diagnosis: decrypt(r.diagnosis_encrypted),
      notes:     decrypt(r.notes_encrypted),
      diagnosis_encrypted: undefined,
      notes_encrypted:     undefined,
    })),
  };
};

module.exports = { getPatients, getPatientDetails, getPatientSummary };
