// incidentController.js
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const incidentController = {
  // Tài xế gửi báo cáo sự cố
  create: async (req, res, next) => {
    try {
      const driverRes = await pool.query('SELECT driver_code FROM drivers WHERE user_id = $1', [req.user.id]);
      if (!driverRes.rows.length) return error(res, 'Không tìm thấy hồ sơ tài xế', 404);
      const { bus_id, trip_code, description } = req.body;
      if (!description) return error(res, 'Thiếu mô tả sự cố', 400);
      const result = await pool.query(
        `INSERT INTO incident_reports (driver_code, bus_id, trip_code, description) VALUES ($1, $2, $3, $4) RETURNING *`,
        [driverRes.rows[0].driver_code, bus_id || null, trip_code || null, description]
      );
      return success(res, result.rows[0], 'Báo cáo sự cố đã được gửi', 201);
    } catch (err) { next(err); }
  },

  // Tài xế xem sự cố của bản thân
  getMy: async (req, res, next) => {
    try {
      const driverRes = await pool.query('SELECT driver_code FROM drivers WHERE user_id = $1', [req.user.id]);
      if (!driverRes.rows.length) return error(res, 'Không tìm thấy hồ sơ tài xế', 404);
      const result = await pool.query(
        'SELECT * FROM incident_reports WHERE driver_code = $1 ORDER BY report_time DESC',
        [driverRes.rows[0].driver_code]
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Điều phối xem tất cả sự cố
  getAll: async (req, res, next) => {
    try {
      const { status } = req.query;
      let query = `SELECT ir.*, d.full_name AS driver_name FROM incident_reports ir JOIN drivers d ON ir.driver_code = d.driver_code WHERE 1=1`;
      const params = [];
      if (status) { params.push(status); query += ` AND ir.status = $${params.length}`; }
      query += ' ORDER BY ir.report_time DESC';
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Điều phối cập nhật trạng thái sự cố + cập nhật xe hỏng
  updateStatus: async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!['pending', 'resolved'].includes(status)) return error(res, 'Trạng thái không hợp lệ', 400);
      const incidentRes = await pool.query('SELECT * FROM incident_reports WHERE id = $1', [req.params.incidentId]);
      if (!incidentRes.rows.length) return error(res, 'Không tìm thấy sự cố', 404);
      const incident = incidentRes.rows[0];
      // Nếu xác nhận sự cố (không phải resolved), đánh xe hỏng
      if (status === 'pending' && incident.bus_id) {
        await pool.query(`UPDATE buses SET status = 'broken' WHERE bus_id = $1`, [incident.bus_id]);
      }
      const result = await pool.query(
        'UPDATE incident_reports SET status = $1 WHERE id = $2 RETURNING *',
        [status, req.params.incidentId]
      );
      return success(res, result.rows[0], 'Cập nhật trạng thái sự cố thành công');
    } catch (err) { next(err); }
  },

  // Xem chuyến bị ảnh hưởng do xe hỏng
  getAffectedTrips: async (req, res, next) => {
    try {
      const incidentRes = await pool.query('SELECT * FROM incident_reports WHERE id = $1', [req.params.incidentId]);
      if (!incidentRes.rows.length) return error(res, 'Không tìm thấy sự cố', 404);
      const { bus_id } = incidentRes.rows[0];
      if (!bus_id) return success(res, [], 'Sự cố không liên quan đến xe cụ thể');
      const result = await pool.query(
        `SELECT t.*, ta.id AS assignment_id, ta.driver_code
         FROM trip_assignments ta JOIN trips t ON ta.trip_code = t.trip_code
         WHERE ta.bus_id = $1 AND ta.status = 'active' AND t.trip_date >= CURRENT_DATE`,
        [bus_id]
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },
};
module.exports = incidentController;
