// notificationController.js: Quản lý thông báo người dùng theo thiết kế mới
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const notificationController = {
  // Lấy thông tin thông báo của người dùng hiện tại
  getMy: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { unread_only } = req.query;

      let query = 'SELECT * FROM notifications WHERE user_id = $1';
      const params = [userId];

      if (unread_only === 'true') {
        query += ' AND is_read = FALSE';
      }
      query += ' ORDER BY created_at DESC';

      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Đánh dấu thông báo là đã đọc
  markAsRead: async (req, res, next) => {
    try {
      const { notificationId } = req.params;
      const userId = req.user.id;

      const result = await pool.query(
        `UPDATE notifications 
         SET is_read = TRUE 
         WHERE notification_id = $1 AND user_id = $2 
         RETURNING *`,
        [notificationId, userId]
      );

      if (!result.rows.length) {
        return error(res, 'Không tìm thấy thông báo này', 404);
      }

      return success(res, result.rows[0], 'Đã đọc thông báo');
    } catch (err) { next(err); }
  },

  // Đánh dấu tất cả thông báo là đã đọc
  markAllAsRead: async (req, res, next) => {
    try {
      const userId = req.user.id;
      await pool.query(
        `UPDATE notifications 
         SET is_read = TRUE 
         WHERE user_id = $1`,
        [userId]
      );
      return success(res, null, 'Đã đọc tất cả thông báo');
    } catch (err) { next(err); }
  }
};

module.exports = notificationController;
