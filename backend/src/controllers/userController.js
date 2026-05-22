// userController.js + configurationController.js
const pool = require('../config/database');
const bcrypt = require('bcrypt');
const { success, error } = require('../utils/responseHelper');

const userController = {
  getAll: async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT u.id, u.username, u.status, u.created_at, r.role_name
         FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.id`
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { username, password, role_id } = req.body;
      if (!username || !password || !role_id) return error(res, 'Thiếu thông tin bắt buộc', 400);
      const hashed = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO users (username, password, role_id) VALUES ($1, $2, $3) RETURNING id, username, status, created_at',
        [username, hashed, role_id]
      );
      return success(res, result.rows[0], 'Tạo tài khoản thành công', 201);
    } catch (err) {
      if (err.code === '23505') return error(res, 'Tên đăng nhập đã tồn tại', 409);
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const { username } = req.body;
      const result = await pool.query(
        'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, status',
        [username, req.params.userId]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy tài khoản', 404);
      return success(res, result.rows[0], 'Cập nhật tài khoản thành công');
    } catch (err) { next(err); }
  },

  updateStatus: async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!['active', 'inactive'].includes(status)) return error(res, 'Trạng thái không hợp lệ', 400);
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
      const { old_password, new_password } = req.body;
      const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      if (!userRes.rows.length) return error(res, 'Không tìm thấy tài khoản', 404);
      const match = await bcrypt.compare(old_password, userRes.rows[0].password);
      if (!match) return error(res, 'Mật khẩu cũ không chính xác', 401);
      const hashed = await bcrypt.hash(new_password, 10);
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);
      return success(res, null, 'Đổi mật khẩu thành công');
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
