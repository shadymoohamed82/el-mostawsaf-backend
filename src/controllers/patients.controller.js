const { runWithRLS }     = require('../config/db');
const queries            = require('../queries/patients.queries');
const { success, error } = require('../utils/apiResponse');
const asyncHandler       = require('../middleware/asyncHandler');

const getPatients = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;
  const { search = '' }        = req.query;

  const patients = await runWithRLS(doctorId, role, async (client) => {
    return queries.getPatients(client, doctorId, search);
  });

  const formatted = patients.map((p) => ({
    id:           p.id,
    name:         p.full_name,
    initial:      p.full_name.charAt(0).toUpperCase(),
    phone:        p.phone,
    email:        p.email,
    total_visits: parseInt(p.total_visits),
    last_visit:   p.last_visit,
  }));

  return success(res, formatted);
});

const getPatientDetails = asyncHandler(async (req, res) => {
  const { id: doctorId, role } = req.user;
  const { id: patientId }      = req.params;

  const patient = await runWithRLS(doctorId, role, async (client) => {
    return queries.getPatientDetails(client, patientId, doctorId);
  });

  if (!patient) return error(res, 'Patient not found', 404);
  return success(res, patient);
});

module.exports = { getPatients, getPatientDetails };