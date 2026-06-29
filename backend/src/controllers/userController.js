// userController.js: Quản lý người dùng và hồ sơ cá nhân theo thiết kế mới
const pool = require('../config/database');
const bcrypt = require('bcrypt');
const { success, error } = require('../utils/responseHelper');
const { emitToUser, broadcast } = require('../sockets/socketManager');

const userController = {
  // Lấy tất cả người dùng
  getAll: async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT user_id, username, full_name, role, status
         FROM users 
         ORDER BY user_id`
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Tạo người dùng mới
  create: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { username, password, role, full_name, phone, license_class } = req.body;

      if (!username || !password || !role || !full_name) {
        return error(res, 'Thiếu thông tin bắt buộc', 400);
      }

      if (!['manager', 'dispatcher', 'driver'].includes(role)) {
        return error(res, 'Vai trò không hợp lệ. Phải là manager, dispatcher hoặc driver.', 400);
      }

      const hashed = await bcrypt.hash(password, 10);
      
      const userResult = await client.query(
        `INSERT INTO users (username, password_hash, full_name, role, status) 
         VALUES ($1, $2, $3, $4, 'active') 
         RETURNING user_id, username, full_name, role, status`,
        [username, hashed, full_name, role]
      );
      const newUser = userResult.rows[0];

      // Nếu vai trò là driver, tạo thêm bản ghi tài xế tương ứng
      if (role === 'driver') {
        await client.query(
          `INSERT INTO drivers (user_id, full_name, phone, license_class, status) 
           VALUES ($1, $2, $3, $4, 'working')`,
          [newUser.user_id, full_name, phone || null, license_class || 'E']
        );
      }

      await client.query('COMMIT');

      // ✅ Gửi thông báo cho manager
      try {
        const content = `Tài khoản mới "${username}" (${full_name}) với vai trò ${role} đã được tạo.`;
        const managers = await pool.query("SELECT user_id FROM users WHERE role = 'manager' AND status = 'active'");
        for (let mgr of managers.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, title, content) VALUES ($1, 'Tài khoản mới được tạo', $2)`,
            [mgr.user_id, content]
          );
        }
        broadcast('NEW_NOTIFICATION', { title: 'Tài khoản mới được tạo', content });
      } catch (e) { console.error('Notification error:', e); }

      return success(res, newUser, 'Tạo tài khoản thành công', 201);
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') return error(res, 'Tên đăng nhập đã tồn tại', 409);
      next(err);
    } finally {
      client.release();
    }
  },

  // Cập nhật người dùng
  update: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { full_name, phone, license_class } = req.body;
      const { userId } = req.params;

      const userResult = await client.query(
        `UPDATE users 
         SET full_name = $1 
         WHERE user_id = $2 
         RETURNING user_id, username, full_name, role, status`,
        [full_name, userId]
      );

      if (!userResult.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Không tìm thấy tài khoản', 404);
      }

      const updatedUser = userResult.rows[0];

      // Nếu user là driver, cập nhật thông tin trong bảng drivers
      if (updatedUser.role === 'driver') {
        await client.query(
          `UPDATE drivers 
           SET full_name = $1, phone = $2, license_class = $3 
           WHERE user_id = $4`,
          [full_name, phone || null, license_class || 'E', userId]
        );
      }

      await client.query('COMMIT');

      // ✅ Gửi thông báo cho manager
      try {
        const content = `Tài khoản "${updatedUser.username}" đã được cập nhật thông tin.`;
        const managers = await pool.query("SELECT user_id FROM users WHERE role = 'manager' AND status = 'active'");
        for (let mgr of managers.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, title, content) VALUES ($1, 'Cập nhật tài khoản', $2)`,
            [mgr.user_id, content]
          );
        }
        broadcast('NEW_NOTIFICATION', { title: 'Cập nhật tài khoản', content });
      } catch (e) { console.error('Notification error:', e); }

      return success(res, updatedUser, 'Cập nhật tài khoản thành công');
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  // Cập nhật trạng thái
  updateStatus: async (req, res, next) => {
    try {
      const { status } = req.body;
      const { userId } = req.params;

      if (!['active', 'locked'].includes(status)) {
        return error(res, 'Trạng thái không hợp lệ', 400);
      }

      const result = await pool.query(
        'UPDATE users SET status = $1 WHERE user_id = $2 RETURNING user_id, username, status',
        [status, userId]
      );

      if (!result.rows.length) return error(res, 'Không tìm thấy tài khoản', 404);

      // ✅ Gửi thông báo cho manager
      try {
        const statusLabel = { active: 'Hoạt động', locked: 'Khóa' };
        const content = `Tài khoản "${result.rows[0].username}" đã chuyển sang trạng thái: ${statusLabel[status]}.`;
        const managers = await pool.query("SELECT user_id FROM users WHERE role = 'manager' AND status = 'active'");
        for (let mgr of managers.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, title, content) VALUES ($1, 'Cập nhật trạng thái tài khoản', $2)`,
            [mgr.user_id, content]
          );
        }
        broadcast('NEW_NOTIFICATION', { title: 'Cập nhật trạng thái tài khoản', content });
      } catch (e) { console.error('Notification error:', e); }

      return success(res, result.rows[0], 'Cập nhật trạng thái tài khoản thành công');
    } catch (err) { next(err); }
  },

  // Đổi mật khẩu tài khoản hiện tại
  changePassword: async (req, res, next) => {
    try {
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        return error(res, 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới', 400);
      }

      const userRes = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.user.id]);
      if (!userRes.rows.length) return error(res, 'Không tìm thấy tài khoản', 404);
      
      const match = await bcrypt.compare(current_password, userRes.rows[0].password_hash);
      if (!match) return error(res, 'Mật khẩu hiện tại không chính xác', 401);

      const hashed = await bcrypt.hash(new_password, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [hashed, req.user.id]);
      return success(res, null, 'Đổi mật khẩu thành công');
    } catch (err) { next(err); }
  },

  // Cập nhật thông tin cá nhân
  updateProfile: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { full_name, phone, license_class } = req.body;
      const userId = req.user.id;

      const result = await client.query(
        'UPDATE users SET full_name = $1 WHERE user_id = $2 RETURNING user_id, username, full_name, role',
        [full_name, userId]
      );
      if (!result.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Không tìm thấy tài khoản', 404);
      }

      const user = result.rows[0];

      if (user.role === 'driver') {
        await client.query(
          'UPDATE drivers SET full_name = $1, phone = $2, license_class = $3 WHERE user_id = $4',
          [full_name, phone || null, license_class || 'E', userId]
        );
        user.phone = phone || null;
        user.license_class = license_class || 'E';
      }

      await client.query('COMMIT');
      return success(res, user, 'Cập nhật thông tin cá nhân thành công');
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  // Kiểm tra trùng username
  checkUsername: async (req, res, next) => {
    try {
      const { username } = req.params;
      const result = await pool.query('SELECT 1 FROM users WHERE LOWER(username) = $1', [username.toLowerCase().trim()]);
      return success(res, { exists: result.rows.length > 0 });
    } catch (err) { next(err); }
  },
};

module.exports = userController;