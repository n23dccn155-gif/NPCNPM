// incidentController.js
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const incidentController = {
  // Tài xế gửi báo cáo sự cố
  create: async (req, res, next) => {
    try {
      const driverRes = await pool.query('SELECT driver_code FROM drivers WHERE user_id = $1', [req.user.id]);
      if (!driverRes.rows.length) return error(res, 'Không tìm thấy hồ sơ tài xế', 404);
      const { bus_id, trip_code, incident_type, description } = req.body;
      if (!description) return error(res, 'Thiếu mô tả sự cố', 400);
      if (!incident_type) return error(res, 'Thiếu loại sự cố', 400);

      const result = await pool.query(
        `INSERT INTO incident_reports (driver_code, bus_id, trip_code, incident_type, description, status) 
         VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
        [driverRes.rows[0].driver_code, bus_id || null, trip_code || null, incident_type, description]
      );

      // Nếu loại sự cố là bus_broken (hỏng xe), tự động cập nhật trạng thái xe thành broken
      if (incident_type === 'bus_broken' && bus_id) {
        await pool.query(`UPDATE buses SET status = 'broken' WHERE bus_id = $1`, [bus_id]);
      }

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
      let query = `
        SELECT ir.*, d.full_name AS driver_name 
        FROM incident_reports ir 
        JOIN drivers d ON ir.driver_code = d.driver_code 
        WHERE 1=1
      `;
      const params = [];
      if (status) { params.push(status); query += ` AND ir.status = $${params.length}`; }
      query += ' ORDER BY ir.report_time DESC';
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Điều phối cập nhật trạng thái sự cố (pending, processing, resolved)
  updateStatus: async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!['pending', 'processing', 'resolved'].includes(status)) {
        return error(res, 'Trạng thái không hợp lệ', 400);
      }
      
      const incidentRes = await pool.query('SELECT * FROM incident_reports WHERE id = $1', [req.params.incidentId]);
      if (!incidentRes.rows.length) return error(res, 'Không tìm thấy sự cố', 404);
      const incident = incidentRes.rows[0];

      // Nếu chuyển trạng thái sự cố thành 'processing' hoặc 'resolved', cập nhật báo cáo sự cố
      const result = await pool.query(
        'UPDATE incident_reports SET status = $1 WHERE id = $2 RETURNING *',
        [status, req.params.incidentId]
      );

      // Nếu incident_type = 'bus_broken' và bus_id có sẵn, đảm bảo xe đó ở trạng thái broken khi bắt đầu xử lý
      if (incident.incident_type === 'bus_broken' && incident.bus_id && status === 'processing') {
        await pool.query(`UPDATE buses SET status = 'broken' WHERE bus_id = $1`, [incident.bus_id]);
      }

      return success(res, result.rows[0], 'Cập nhật trạng thái sự cố thành công');
    } catch (err) { next(err); }
  },

  // Xem chuyến bị ảnh hưởng do xe hỏng hoặc sự cố của chuyến
  getAffectedTrips: async (req, res, next) => {
    try {
      const incidentRes = await pool.query('SELECT * FROM incident_reports WHERE id = $1', [req.params.incidentId]);
      if (!incidentRes.rows.length) return error(res, 'Không tìm thấy sự cố', 404);
      const { bus_id, trip_code } = incidentRes.rows[0];
      
      // Nếu có chuyến xe cụ thể bị ảnh hưởng trực tiếp
      if (trip_code) {
        const result = await pool.query(
          `SELECT t.*, ta.id AS assignment_id, ta.driver_code, ta.bus_id, r.route_name
           FROM trips t
           JOIN routes r ON t.route_code = r.route_code
           LEFT JOIN trip_assignments ta ON t.trip_code = ta.trip_code AND ta.status = 'active'
           WHERE t.trip_code = $1`,
          [trip_code]
        );
        return success(res, result.rows);
      }
      
      if (!bus_id) return success(res, [], 'Sự cố không liên quan đến xe cụ thể');

      // Nếu là xe hỏng, tìm các chuyến tương lai sử dụng xe này
      const result = await pool.query(
        `SELECT t.*, ta.id AS assignment_id, ta.driver_code, ta.bus_id, r.route_name
         FROM trip_assignments ta 
         JOIN trips t ON ta.trip_code = t.trip_code
         JOIN routes r ON t.route_code = r.route_code
         WHERE ta.bus_id = $1 AND ta.status = 'active' AND t.trip_date >= CURRENT_DATE`,
        [bus_id]
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },
};
module.exports = incidentController;
