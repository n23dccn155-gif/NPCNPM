// incidentController.js: Quản lý báo cáo sự cố từ tài xế theo thiết kế mới
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const incidentController = {
  // Tài xế gửi báo cáo sự cố (XL14)
  create: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const driverRes = await client.query('SELECT driver_id, full_name FROM drivers WHERE user_id = $1', [req.user.id]);
      if (!driverRes.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Không tìm thấy hồ sơ tài xế', 404);
      }
      const driver = driverRes.rows[0];

      const { bus_id, trip_id, incident_type, description } = req.body;
      if (!incident_type || !description) {
        await client.query('ROLLBACK');
        return error(res, 'Vui lòng điền loại sự cố và mô tả chi tiết', 400);
      }

      const result = await client.query(
        `INSERT INTO incident_reports (reported_by, bus_id, trip_id, incident_type, description, status) 
         VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
        [req.user.id, bus_id || null, trip_id || null, incident_type, description]
      );

      // Nếu loại sự cố là hỏng xe (bus_broken), cập nhật trạng thái xe thành 'broken'
      if (incident_type === 'bus_broken' && bus_id) {
        await client.query("UPDATE buses SET status = 'broken' WHERE bus_id = $1", [bus_id]);
      }

      // Tạo thông báo cho các điều phối viên (dispatcher) để xử lý khẩn cấp
      const dispatchers = await client.query("SELECT user_id FROM users WHERE role = 'dispatcher' AND status = 'active'");
      const content = `Tài xế ${driver.full_name} đã báo cáo sự cố loại "${incident_type}" ở xe ${bus_id || 'chưa rõ'}. Mô tả: ${description}`;
      
      for (let disp of dispatchers.rows) {
        await client.query(
          `INSERT INTO notifications (user_id, title, content) 
           VALUES ($1, 'Sự cố khẩn cấp', $2)`,
          [disp.user_id, content]
        );
      }

      await client.query('COMMIT');
      return success(res, result.rows[0], 'Gửi báo cáo sự cố thành công', 201);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  // Tài xế xem danh sách sự cố mình báo cáo
  getMy: async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT ir.*, b.license_plate, t.trip_order
         FROM incident_reports ir
         LEFT JOIN buses b ON ir.bus_id = b.bus_id
         LEFT JOIN trips t ON ir.trip_id = t.trip_id
         WHERE ir.reported_by = $1 
         ORDER BY ir.incident_id DESC`,
        [req.user.id]
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Điều phối viên xem toàn bộ sự cố
  getAll: async (req, res, next) => {
    try {
      const { status } = req.query;
      let query = `
        SELECT ir.*, u.full_name AS driver_name, b.license_plate, t.trip_order
        FROM incident_reports ir
        JOIN users u ON ir.reported_by = u.user_id
        LEFT JOIN buses b ON ir.bus_id = b.bus_id
        LEFT JOIN trips t ON ir.trip_id = t.trip_id
      `;
      const params = [];
      if (status) {
        params.push(status);
        query += ` WHERE ir.status = $1`;
      }
      query += ' ORDER BY ir.incident_id DESC';
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Điều phối cập nhật trạng thái xử lý sự cố
  updateStatus: async (req, res, next) => {
    try {
      const { incidentId } = req.params;
      const { status } = req.body; // 'pending', 'processing', 'resolved'

      if (!['pending', 'processing', 'resolved'].includes(status)) {
        return error(res, 'Trạng thái không hợp lệ', 400);
      }

      const incidentRes = await pool.query('SELECT * FROM incident_reports WHERE incident_id = $1', [incidentId]);
      if (!incidentRes.rows.length) {
        return error(res, 'Không tìm thấy sự cố này', 404);
      }
      const incident = incidentRes.rows[0];

      const result = await pool.query(
        `UPDATE incident_reports 
         SET status = $1 
         WHERE incident_id = $2 
         RETURNING *`,
        [status, incidentId]
      );

      // Nếu đã xử lý xong và lỗi hỏng xe, ta có thể phục hồi trạng thái xe nếu cần thiết (hoặc để gara làm, ở đây ta cập nhật trạng thái sự cố thôi)
      // Thông báo lại cho tài xế/người báo gửi báo cáo
      const reporterId = incident.reported_by;
      if (reporterId) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, content) 
           VALUES ($1, 'Cập nhật xử lý sự cố', $2)`,
          [reporterId, `Báo cáo sự cố của bạn đã được chuyển sang trạng thái: ${status}.`]
        );
      }

      return success(res, result.rows[0], 'Cập nhật trạng thái sự cố thành công');
    } catch (err) { next(err); }
  },

  // Xem các nhóm chuyến bị ảnh hưởng do xe hỏng trong sự cố
  getAffectedGroups: async (req, res, next) => {
    try {
      const { incidentId } = req.params;
      const incidentRes = await pool.query('SELECT * FROM incident_reports WHERE incident_id = $1', [incidentId]);
      if (!incidentRes.rows.length) {
        return error(res, 'Không tìm thấy sự cố', 404);
      }
      const { bus_id } = incidentRes.rows[0];

      if (!bus_id) {
        return success(res, [], 'Sự cố không liên quan đến xe cụ thể');
      }

      const result = await pool.query(
        `SELECT tg.group_id, tg.group_name, tg.start_time, tg.end_time, p.route_code,
                a.bus_id, a.driver_id, b.license_plate, d.full_name as driver_name
         FROM assignments a
         JOIN trip_groups tg ON a.group_id = tg.group_id
         JOIN operation_plans p ON tg.plan_id = p.plan_id
         JOIN buses b ON a.bus_id = b.bus_id
         JOIN drivers d ON a.driver_id = d.driver_id
         WHERE a.bus_id = $1 AND a.status = 'active' AND tg.end_time >= NOW()`,
        [bus_id]
      );

      return success(res, result.rows);
    } catch (err) { next(err); }
  }
};

module.exports = incidentController;
