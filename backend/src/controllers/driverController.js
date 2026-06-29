// driverController.js: Quản lý danh sách tài xế theo thiết kế mới
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const driverController = {
  // Lấy danh sách tài xế
  getAll: async (req, res, next) => {
    try {
      const { status, exclude_assigned } = req.query;
      let query = `
        SELECT d.driver_id, d.user_id, d.full_name, d.phone, d.license_class, d.status, u.username 
        FROM drivers d 
        LEFT JOIN users u ON d.user_id = u.user_id
      `;
      const params = [];
      const conditions = [];

      if (status) {
        params.push(status);
        conditions.push(`d.status = $${params.length}`);
      }

      if (exclude_assigned === 'true') {
        conditions.push(`d.driver_id NOT IN (SELECT driver_id FROM route_drivers)`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY d.driver_id';
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Lấy chi tiết tài xế
  getOne: async (req, res, next) => {
    try {
      const { driverId } = req.params;
      const result = await pool.query(
        `SELECT d.driver_id, d.user_id, d.full_name, d.phone, d.license_class, d.status, u.username 
         FROM drivers d 
         LEFT JOIN users u ON d.user_id = u.user_id 
         WHERE d.driver_id = $1`,
        [driverId]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy tài xế', 404);
      return success(res, result.rows[0]);
    } catch (err) { next(err); }
  },

  // Tạo tài xế mới (lưu ý: tài xế phải được liên kết với một user có role = driver)
  create: async (req, res, next) => {
    try {
      const { user_id, full_name, phone, license_class } = req.body;
      if (!user_id || !full_name) {
        return error(res, 'Thiếu thông tin user_id hoặc tên tài xế', 400);
      }

      // Kiểm tra user có tồn tại và có role = driver không
      const userRes = await pool.query('SELECT role FROM users WHERE user_id = $1', [user_id]);
      if (!userRes.rows.length) {
        return error(res, 'Không tìm thấy tài khoản người dùng', 404);
      }
      if (userRes.rows[0].role !== 'driver') {
        return error(res, 'Tài khoản người dùng phải có vai trò là driver', 400);
      }

      const result = await pool.query(
        `INSERT INTO drivers (user_id, full_name, phone, license_class, status) 
         VALUES ($1, $2, $3, $4, 'working') 
         RETURNING driver_id, user_id, full_name, phone, license_class, status`,
        [user_id, full_name, phone || null, license_class || 'E']
      );
      return success(res, result.rows[0], 'Thêm tài xế thành công', 201);
    } catch (err) {
      if (err.code === '23505') return error(res, 'Tài khoản này đã được liên kết với tài xế khác', 409);
      next(err);
    }
  },

  // Cập nhật thông tin tài xế
  update: async (req, res, next) => {
    try {
      const { driverId } = req.params;
      const { full_name, phone, license_class } = req.body;
      if (!full_name) {
        return error(res, 'Thiếu thông tin tên tài xế', 400);
      }

      const result = await pool.query(
        `UPDATE drivers 
         SET full_name = $1, phone = $2, license_class = $3 
         WHERE driver_id = $4 
         RETURNING driver_id, user_id, full_name, phone, license_class, status`,
        [full_name, phone || null, license_class || 'E', driverId]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy tài xế', 404);
      return success(res, result.rows[0], 'Cập nhật tài xế thành công');
    } catch (err) { next(err); }
  },

  // Cập nhật trạng thái tài xế
  updateStatus: async (req, res, next) => {
    try {
      const { driverId } = req.params;
      const { status } = req.body;
      if (!['working', 'on_leave', 'inactive'].includes(status)) {
        return error(res, 'Trạng thái tài xế không hợp lệ. Phải là working, on_leave hoặc inactive.', 400);
      }
      const result = await pool.query(
        `UPDATE drivers 
         SET status = $1 
         WHERE driver_id = $2 
         RETURNING driver_id, user_id, full_name, phone, license_class, status`,
        [status, driverId]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy tài xế', 404);
      return success(res, result.rows[0], 'Cập nhật trạng thái tài xế thành công');
    } catch (err) { next(err); }
  },
};

module.exports = driverController;
