const { runWithRLS }       = require('../config/db');
const queries              = require('../queries/settings.queries');
const { success, error }   = require('../utils/apiResponse');
const asyncHandler         = require('../middleware/asyncHandler');

// GET /api/settings/profile
const getProfile = asyncHandler(async (req, res) => {
  const { id, role } = req.user;

  const profile = await runWithRLS(id, role, async (client) => {
    return queries.getProfile(client, id);
  });

  if (!profile) return error(res, 'User not found', 404);
  return success(res, profile);
});

// PUT /api/settings/profile
const updateProfile = asyncHandler(async (req, res) => {
  const { id, role } = req.user;
  const { full_name, phone, date_of_birth } = req.body;

  if (!full_name && !phone) {
    return error(res, 'At least one field is required', 400);
  }

  await runWithRLS(id, role, async (client) => {
    return queries.updateProfile(client, { full_name, phone, date_of_birth });
  });

  // اجيب البروفايل المحدث
  const updated = await runWithRLS(id, role, async (client) => {
    return queries.getProfile(client, id);
  });

  return success(res, updated, 'Profile updated successfully');
});

// GET /api/settings/activity
const getRecentActivity = asyncHandler(async (req, res) => {
  const { id, role } = req.user;

  const activity = await runWithRLS(id, role, async (client) => {
    return queries.getRecentActivity(client, id);
  });

  const formatted = activity.map((a) => ({
    table:     a.table_name,
    operation: a.operation,
    time:      a.changed_at,
    data:      a.row_data,
  }));

  return success(res, formatted);
});

// GET /api/settings/specializations
const getSpecializations = asyncHandler(async (req, res) => {
  const { id, role } = req.user;

  const specs = await runWithRLS(id, role, async (client) => {
    return queries.getSpecializations(client);
  });

  return success(res, specs);
});

// DELETE /api/settings/account
const deleteAccount = asyncHandler(async (req, res) => {
  const { id, role } = req.user;

  const deleted = await runWithRLS(id, role, async (client) => {
    return queries.softDeleteUser(client, id);
  });

  if (!deleted) return error(res, 'User not found', 404);
  return success(res, null, 'Account deleted successfully');
});

module.exports = { getProfile, updateProfile, getRecentActivity, getSpecializations, deleteAccount };