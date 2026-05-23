// driverController.js
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const driverController = {
  getAll: async (req, res, next) => {
    try {
      const { status } = req.query;
      let query = `SELECT d.*, u.username, u.full_name, u.phone FROM drivers d LEFT JOIN users u ON d.user_id = u.id`;
      const params = [];
      if (status) { query += ' WHERE d.status = $1'; params.push(status); }
      query += ' ORDER BY d.driver_code';
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  getOne: async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT d.*, u.username, u.full_name, u.phone FROM drivers d LEFT JOIN users u ON d.user_id = u.id WHERE d.driver_code = $1`,
        [req.params.driverCode]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy tài xế', 404);
      return success(res, result.rows[0]);
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { driver_code, full_name, user_id, license_type } = req.body;
      if (!driver_code || !full_name) return error(res, 'Thiếu thông tin bắt buộc', 400);
      const result = await pool.query(
        'INSERT INTO drivers (driver_code, full_name, user_id, license_type) VALUES ($1, $2, $3, $4) RETURNING *',
        [driver_code, full_name, user_id || null, license_type || 'E']
      );
      return success(res, result.rows[0], 'Thêm tài xế thành công', 201);
    } catch (err) {
      if (err.code === '23505') return error(res, 'Mã tài xế hoặc tài khoản đã được sử dụng', 409);
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const { full_name, user_id, license_type } = req.body;
      const result = await pool.query(
        'UPDATE drivers SET full_name = $1, user_id = $2, license_type = $3 WHERE driver_code = $4 RETURNING *',
        [full_name, user_id || null, license_type || 'E', req.params.driverCode]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy tài xế', 404);
      return success(res, result.rows[0], 'Cập nhật tài xế thành công');
    } catch (err) { next(err); }
  },

  updateStatus: async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!['active', 'suspended', 'inactive'].includes(status)) return error(res, 'Trạng thái không hợp lệ', 400);
      const result = await pool.query(
        'UPDATE drivers SET status = $1 WHERE driver_code = $2 RETURNING *',
        [status, req.params.driverCode]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy tài xế', 404);
      return success(res, result.rows[0], 'Cập nhật trạng thái tài xế thành công');
    } catch (err) { next(err); }
  },
};
module.exports = driverController;
