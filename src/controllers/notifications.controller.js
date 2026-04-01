const { runWithRLS }     = require('../config/db');
const queries            = require('../queries/notifications.queries');
const { success, error } = require('../utils/apiResponse');
const asyncHandler       = require('../middleware/asyncHandler');

const getNotifications = asyncHandler(async (req, res) => {
  const { id, role } = req.user;

  const [notifications, unread] = await runWithRLS(id, role, async (client) => {
    return Promise.all([
      queries.getNotifications(client, id),
      queries.getUnreadCount(client, id),
    ]);
  });

  return success(res, { notifications, unread_count: unread });
});

const markAsRead = asyncHandler(async (req, res) => {
  const { id, role } = req.user;
  const { notifId }  = req.params;

  const updated = await runWithRLS(id, role, async (client) => {
    return queries.markAsRead(client, notifId, id);
  });

  if (!updated) return error(res, 'Notification not found', 404);
  return success(res, updated, 'Marked as read');
});

const markAllAsRead = asyncHandler(async (req, res) => {
  const { id, role } = req.user;

  await runWithRLS(id, role, async (client) => {
    return queries.markAllAsRead(client, id);
  });

  return success(res, null, 'All notifications marked as read');
});

module.exports = { getNotifications, markAsRead, markAllAsRead };