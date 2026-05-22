// leaveRequestController.js
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const leaveRequestController = {
  // Tài xế xem yêu cầu nghỉ của bản thân
  getMy: async (req, res, next) => {
    try {
      const driverRes = await pool.query('SELECT driver_code FROM drivers WHERE user_id = $1', [req.user.id]);
      if (!driverRes.rows.length) return error(res, 'Không tìm thấy hồ sơ tài xế', 404);
      const result = await pool.query(
        'SELECT * FROM leave_requests WHERE driver_code = $1 ORDER BY created_at DESC',
        [driverRes.rows[0].driver_code]
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Tài xế gửi yêu cầu nghỉ
  create: async (req, res, next) => {
    try {
      const driverRes = await pool.query('SELECT driver_code FROM drivers WHERE user_id = $1', [req.user.id]);
      if (!driverRes.rows.length) return error(res, 'Không tìm thấy hồ sơ tài xế', 404);
      const { leave_date, reason } = req.body;
      if (!leave_date) return error(res, 'Thiếu ngày nghỉ', 400);
      const result = await pool.query(
        `INSERT INTO leave_requests (driver_code, leave_date, reason) VALUES ($1, $2, $3) RETURNING *`,
        [driverRes.rows[0].driver_code, leave_date, reason || null]
      );
      return success(res, result.rows[0], 'Gửi yêu cầu nghỉ thành công', 201);
    } catch (err) { next(err); }
  },

  // Quản lý xem tất cả yêu cầu nghỉ
  getAll: async (req, res, next) => {
    try {
      const { status } = req.query;
      let query = `
        SELECT lr.*, d.full_name AS driver_name FROM leave_requests lr
        JOIN drivers d ON lr.driver_code = d.driver_code
        WHERE 1=1
      `;
      const params = [];
      if (status) { params.push(status); query += ` AND lr.status = $${params.length}`; }
      query += ' ORDER BY lr.created_at DESC';
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Quản lý duyệt hoặc từ chối yêu cầu nghỉ
  review: async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!['approved', 'rejected'].includes(status)) return error(res, 'Trạng thái không hợp lệ', 400);
      const result = await pool.query(
        `UPDATE leave_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW()
         WHERE id = $3 AND status = 'pending' RETURNING *`,
        [status, req.user.id, req.params.requestId]
      );
      if (!result.rows.length) return error(res, 'Yêu cầu không tồn tại hoặc đã được xử lý', 404);
      return success(res, result.rows[0], `Đã ${status === 'approved' ? 'duyệt' : 'từ chối'} yêu cầu nghỉ`);
    } catch (err) { next(err); }
  },

  // Xem chuyến bị ảnh hưởng do yêu cầu nghỉ đã duyệt
  getAffectedTrips: async (req, res, next) => {
    try {
      const leaveRes = await pool.query('SELECT * FROM leave_requests WHERE id = $1', [req.params.requestId]);
      if (!leaveRes.rows.length) return error(res, 'Không tìm thấy yêu cầu nghỉ', 404);
      const leave = leaveRes.rows[0];
      const result = await pool.query(
        `SELECT t.*, ta.id AS assignment_id, ta.bus_id
         FROM trip_assignments ta JOIN trips t ON ta.trip_code = t.trip_code
         WHERE ta.driver_code = $1 AND t.trip_date = $2 AND ta.status = 'active'`,
        [leave.driver_code, leave.leave_date]
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },
};
module.exports = leaveRequestController;
