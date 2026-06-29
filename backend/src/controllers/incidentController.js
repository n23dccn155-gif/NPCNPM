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
        await client.query("UPDATE buses SET status = 'maintenance' WHERE bus_id = $1", [bus_id]);
        
        if (trip_id) {
          // Tách nhóm chuyến (trip_group)
          const tripRes = await client.query("SELECT plan_id, group_id, scheduled_departure FROM trips WHERE trip_id = $1", [trip_id]);
          if (tripRes.rows.length > 0) {
            const brokenTrip = tripRes.rows[0];
            const groupId = brokenTrip.group_id;
            
            if (groupId) {
              // Cập nhật trạng thái chuyến bị hỏng thành 'cancelled' (hủy chuyến)
              await client.query("UPDATE trips SET status = 'cancelled' WHERE trip_id = $1", [trip_id]);

              const oldGroupRes = await client.query("SELECT * FROM trip_groups WHERE group_id = $1", [groupId]);
              if (oldGroupRes.rows.length > 0) {
                const oldGroup = oldGroupRes.rows[0];
                
                // Lấy các chuyến còn lại SAU chuyến bị hỏng
                const remainingTripsRes = await client.query(
                  "SELECT trip_id, scheduled_departure, scheduled_arrival FROM trips WHERE group_id = $1 AND scheduled_departure > $2 ORDER BY scheduled_departure ASC",
                  [groupId, brokenTrip.scheduled_departure]
                );
                
                if (remainingTripsRes.rows.length > 0) {
                  // Tạo nhóm mới
                  const firstRemaining = remainingTripsRes.rows[0];
                  const lastRemaining = remainingTripsRes.rows[remainingTripsRes.rows.length - 1];
                  const newGroupRes = await client.query(
                    `INSERT INTO trip_groups (plan_id, group_name, start_time, end_time, status)
                     VALUES ($1, $2, $3, $4, 'unassigned') RETURNING group_id`,
                    [oldGroup.plan_id, oldGroup.group_name + ' (Tách)', firstRemaining.scheduled_departure, lastRemaining.scheduled_arrival]
                  );
                  const newGroupId = newGroupRes.rows[0].group_id;
                  
                  // Cập nhật group_id cho các chuyến còn lại
                  const remainingTripIds = remainingTripsRes.rows.map(t => t.trip_id);
                  await client.query("UPDATE trips SET group_id = $1 WHERE trip_id = ANY($2::int[])", [newGroupId, remainingTripIds]);
                  
                  // Cập nhật end_time cho nhóm cũ
                  const pastTripsRes = await client.query("SELECT scheduled_arrival FROM trips WHERE group_id = $1 ORDER BY scheduled_arrival DESC LIMIT 1", [groupId]);
                  if (pastTripsRes.rows.length > 0) {
                    await client.query("UPDATE trip_groups SET end_time = $1 WHERE group_id = $2", [pastTripsRes.rows[0].scheduled_arrival, groupId]);
                  }
                  
                  // Tạo assignment mới (trống tài xế, trống xe để autoReallocateBuses tự điền) cho nhóm mới
                  const oldAssignRes = await client.query("SELECT * FROM assignments WHERE group_id = $1 AND status = 'active'", [groupId]);
                  if (oldAssignRes.rows.length > 0) {
                    const oldAssign = oldAssignRes.rows[0];
                    await client.query(
                      `INSERT INTO assignments (plan_id, group_id, bus_id, driver_id, assignment_type, assigned_by, status)
                       VALUES ($1, $2, NULL, NULL, $3, $4, 'active')`,
                      [oldAssign.plan_id, newGroupId, oldAssign.assignment_type, oldAssign.assigned_by]
                    );
                  }
                }
              }
            }
          }
        }
      }
      
      // ...
        // Tạo thông báo cho các điều phối viên
        const dispatchers = await client.query("SELECT user_id FROM users WHERE role = 'dispatcher' AND status = 'active'");
        const content = `Tài xế ${driver.full_name} đã báo cáo sự cố loại "${incident_type}" ở xe ${bus_id || 'chưa rõ'}. Mô tả: ${description}`;
        
        for (let disp of dispatchers.rows) {
          await client.query(
            `INSERT INTO notifications (user_id, title, content, redirect_url) 
             VALUES ($1, 'Sự cố khẩn cấp', $2, '/dispatcher/incidents')`,
            [disp.user_id, content]
          );
        }

        await client.query('COMMIT');
        
        // Kích hoạt thuật toán dồn toa SAU KHI ĐÃ COMMIT để transaction khác nhìn thấy data
        const assignmentController = require('./assignmentController');
        const rbRes = await client.query("SELECT route_code FROM route_buses WHERE bus_id = $1", [bus_id]);
        if (rbRes.rows.length > 0) {
           const routeCode = rbRes.rows[0].route_code;
           await assignmentController.autoReallocateBuses(routeCode, bus_id).catch(e => console.error(e));
        }

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
        const content = `Báo cáo sự cố của bạn đã được chuyển sang trạng thái: ${status}.`;
        await pool.query(
<<<<<<< HEAD
          `INSERT INTO notifications (user_id, title, content) 
           VALUES ($1, 'Cập nhật xử lý sự cố', $2)`,
          [reporterId, content]
=======
          `INSERT INTO notifications (user_id, title, content, redirect_url) 
           VALUES ($1, 'Cập nhật xử lý sự cố', $2, '/driver/incidents')`,
          [reporterId, `Báo cáo sự cố của bạn đã được chuyển sang trạng thái: ${status}.`]
>>>>>>> ed64ea497b8925f8778ff9f6b7f8fbdbff782002
        );
        const { emitToUser } = require('../sockets/socketManager');
        emitToUser(reporterId, 'NEW_NOTIFICATION', { title: 'Cập nhật xử lý sự cố', content });
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
