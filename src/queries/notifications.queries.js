const getNotifications = async (client, userId) => {
  const sql = `
    SELECT id, message, is_read, created_at
    FROM notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 20
  `;
  const result = await client.query(sql, [userId]);
  return result.rows;
};

const getUnreadCount = async (client, userId) => {
  const sql = `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`;
  const result = await client.query(sql, [userId]);
  return parseInt(result.rows[0].count);
};

const markAsRead = async (client, notificationId, userId) => {
  const sql = `
    UPDATE notifications SET is_read = TRUE
    WHERE id = $1 AND user_id = $2
    RETURNING *
  `;
  const result = await client.query(sql, [notificationId, userId]);
  return result.rows[0] || null;
};

const markAllAsRead = async (client, userId) => {
  const sql = `
    UPDATE notifications SET is_read = TRUE
    WHERE user_id = $1 AND is_read = FALSE
  `;
  await client.query(sql, [userId]);
};

const createNotification = async (client, userId, message) => {
  const sql = `
    INSERT INTO notifications (user_id, message)
    VALUES ($1, $2)
    RETURNING *
  `;
  const result = await client.query(sql, [userId, message]);
  return result.rows[0];
};

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead, createNotification };