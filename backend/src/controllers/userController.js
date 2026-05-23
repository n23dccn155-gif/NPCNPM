// userController.js + configurationController.js
const pool = require('../config/database');
const bcrypt = require('bcrypt');
const { success, error } = require('../utils/responseHelper');

const userController = {
  getAll: async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT u.id, u.username, u.full_name, u.phone, u.status, u.created_at, r.role_name
         FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.id`
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { username, password, role_id, full_name, phone } = req.body;
      if (!username || !password || !role_id) return error(res, 'Thiếu thông tin bắt buộc', 400);
      const hashed = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO users (username, password, role_id, full_name, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, phone, status, created_at',
        [username, hashed, role_id, full_name || 'User', phone || null]
      );
      return success(res, result.rows[0], 'Tạo tài khoản thành công', 201);
    } catch (err) {
      if (err.code === '23505') return error(res, 'Tên đăng nhập đã tồn tại', 409);
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const { username, full_name, phone } = req.body;
      const result = await pool.query(
        'UPDATE users SET username = $1, full_name = $2, phone = $3 WHERE id = $4 RETURNING id, username, full_name, phone, status',
        [username, full_name || 'User', phone || null, req.params.userId]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy tài khoản', 404);
      return success(res, result.rows[0], 'Cập nhật tài khoản thành công');
    } catch (err) { next(err); }
  },

  updateStatus: async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!['active', 'inactive', 'locked'].includes(status)) return error(res, 'Trạng thái không hợp lệ', 400);
      const result = await pool.query(
        'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, username, status',
        [status, req.params.userId]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy tài khoản', 404);
      return success(res, result.rows[0], 'Cập nhật trạng thái tài khoản thành công');
    } catch (err) { next(err); }
  },

  updateRole: async (req, res, next) => {
    try {
      const { role_id } = req.body;
      const result = await pool.query(
        'UPDATE users SET role_id = $1 WHERE id = $2 RETURNING id, username, role_id',
        [role_id, req.params.userId]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy tài khoản', 404);
      return success(res, result.rows[0], 'Cập nhật vai trò thành công');
    } catch (err) { next(err); }
  },

  changePassword: async (req, res, next) => {
    try {
      const old_password = req.body.old_password || req.body.current_password;
      const { new_password } = req.body;
      const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      if (!userRes.rows.length) return error(res, 'Không tìm thấy tài khoản', 404);
      const match = await bcrypt.compare(old_password, userRes.rows[0].password);
      if (!match) return error(res, 'Mật khẩu cũ không chính xác', 401);
      const hashed = await bcrypt.hash(new_password, 10);
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);
      return success(res, null, 'Đổi mật khẩu thành công');
    } catch (err) { next(err); }
  },

  updateProfile: async (req, res, next) => {
    try {
      const { full_name, phone } = req.body;
      const result = await pool.query(
        'UPDATE users SET full_name = $1, phone = $2 WHERE id = $3 RETURNING id, username, full_name, phone',
        [full_name, phone || null, req.user.id]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy tài khoản', 404);
      return success(res, result.rows[0], 'Cập nhật thông tin cá nhân thành công');
    } catch (err) { next(err); }
  },
};

const configurationController = {
  getAll: async (req, res, next) => {
    try {
      const result = await pool.query('SELECT * FROM configurations ORDER BY config_key');
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const { config_value } = req.body;
      const result = await pool.query(
        'UPDATE configurations SET config_value = $1 WHERE config_key = $2 RETURNING *',
        [config_value, req.params.configKey]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy cấu hình', 404);
      return success(res, result.rows[0], 'Cập nhật cấu hình thành công');
    } catch (err) { next(err); }
  },
};

module.exports = { userController, configurationController };
