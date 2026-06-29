// notificationController.js: Quản lý thông báo người dùng theo thiết kế mới
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const notificationController = {
  // Lấy thông tin thông báo của người dùng hiện tại
  // Query params:
  //   unread_only=true  -> chỉ lấy chưa đọc (mặc định)
  //   read_only=true    -> chỉ lấy đã đọc
  //   limit, offset     -> phân trang
  getMy: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { unread_only, read_only, limit, offset } = req.query;

      let query = 'SELECT * FROM notifications WHERE user_id = $1';
      const params = [userId];

      if (unread_only === 'true') {
        query += ' AND is_read = FALSE';
      } else if (read_only === 'true') {
        query += ' AND is_read = TRUE';
      }
      query += ' ORDER BY created_at DESC';

      // Phân trang
      const lim = Math.min(parseInt(limit, 10) || 50, 200);
      const off = Math.max(parseInt(offset, 10) || 0, 0);
      query += ` LIMIT ${lim} OFFSET ${off}`;

      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Lấy lịch sử thông báo (CẢ đã đọc + chưa đọc) với phân trang
  // Query params:
  //   page     -> trang (mặc định 1)
  //   pageSize -> số bản ghi mỗi trang (mặc định 20, tối đa 100)
  //   from, to -> lọc theo khoảng ngày (YYYY-MM-DD)
  //   read     -> all | unread | read (mặc định all)
  //   search   -> tìm trong title hoặc content (ILIKE)
  getHistory: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const {
        page = 1,
        pageSize = 20,
        from,
        to,
        read = 'all',
        search
      } = req.query;

      const lim = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100);
      const pg = Math.max(parseInt(page, 10) || 1, 1);
      const off = (pg - 1) * lim;

      const conditions = ['user_id = $1'];
      const params = [userId];
      let pIdx = params.length;

      if (from) {
        pIdx += 1;
        params.push(from);
        conditions.push(`created_at >= $${pIdx}`);
      }
      if (to) {
        // inclusive: lấy đến hết ngày `to`
        pIdx += 1;
        params.push(to);
        conditions.push(`created_at < ($${pIdx}::date + INTERVAL '1 day')`);
      }
      if (read === 'unread') {
        conditions.push('is_read = FALSE');
      } else if (read === 'read') {
        conditions.push('is_read = TRUE');
      }
      if (search) {
        pIdx += 1;
        params.push(`%${search}%`);
        conditions.push(`(title ILIKE $${pIdx} OR content ILIKE $${pIdx})`);
      }

      const whereSql = conditions.join(' AND ');

      // Đếm tổng để tính tổng số trang
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM notifications WHERE ${whereSql}`,
        params
      );
      const total = countRes.rows[0].total;

      // Lấy dữ liệu trang hiện tại
      const dataRes = await pool.query(
        `SELECT * FROM notifications
         WHERE ${whereSql}
         ORDER BY created_at DESC
         LIMIT ${lim} OFFSET ${off}`,
        params
      );

      return success(res, {
        items: dataRes.rows,
        pagination: {
          page: pg,
          pageSize: lim,
          total,
          totalPages: Math.max(Math.ceil(total / lim), 1)
        },
        unread_count: (
          await pool.query(
            'SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND is_read = FALSE',
            [userId]
          )
        ).rows[0].c
      });
    } catch (err) { next(err); }
  },

  // Xoá 1 thông báo (chỉ thông báo của chính user đó)
  deleteOne: async (req, res, next) => {
    try {
      const { notificationId } = req.params;
      const userId = req.user.id;

      const result = await pool.query(
        `DELETE FROM notifications
         WHERE notification_id = $1 AND user_id = $2
         RETURNING notification_id`,
        [notificationId, userId]
      );

      if (!result.rows.length) {
        return error(res, 'Không tìm thấy thông báo này', 404);
      }

      return success(res, null, 'Đã xoá thông báo');
    } catch (err) { next(err); }
  },

  // Xoá tất cả thông báo đã đọc của user hiện tại
  deleteAllRead: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const result = await pool.query(
        `DELETE FROM notifications
         WHERE user_id = $1 AND is_read = TRUE
         RETURNING notification_id`,
        [userId]
      );
      return success(res, { deleted: result.rowCount }, 'Đã xoá tất cả thông báo đã đọc');
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
