// tripController.js: Nghiệp vụ ghi nhận hành trình chuyến xe (XL10, XL11) theo thiết kế mới
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const tripController = {
  // Lấy danh sách chuyến xe (có thể lọc theo plan_id, group_id, date, status, v.v.)
  getAll: async (req, res, next) => {
    try {
      const { plan_id, group_id, date, status } = req.query;
      let query = `
        SELECT t.*, tg.group_name, rd.route_code, rd.direction_type, rd.start_point, rd.end_point, b.license_plate, d.full_name as driver_name
        FROM trips t
        JOIN trip_groups tg ON t.group_id = tg.group_id
        JOIN route_directions rd ON t.direction_id = rd.direction_id
        LEFT JOIN assignments a ON tg.group_id = a.group_id AND a.status = 'active'
        LEFT JOIN buses b ON a.bus_id = b.bus_id
        LEFT JOIN drivers d ON a.driver_id = d.driver_id
      `;
      const params = [];
      const conditions = [];

      if (plan_id) {
        params.push(plan_id);
        conditions.push(`t.plan_id = $${params.length}`);
      }
      if (group_id) {
        params.push(group_id);
        conditions.push(`t.group_id = $${params.length}`);
      }
      if (date) {
        params.push(date);
        conditions.push(`DATE(t.scheduled_departure) = $${params.length}`);
      }
      if (status) {
        params.push(status);
        conditions.push(`t.status = $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY t.scheduled_departure';

      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Chi tiết chuyến xe
  getOne: async (req, res, next) => {
    try {
      const { tripId } = req.params;
      const result = await pool.query(
        `SELECT t.*, tg.group_name, rd.route_code, rd.direction_type, rd.start_point, rd.end_point, b.license_plate, d.full_name as driver_name
         FROM trips t
         JOIN trip_groups tg ON t.group_id = tg.group_id
         JOIN route_directions rd ON t.direction_id = rd.direction_id
         LEFT JOIN assignments a ON tg.group_id = a.group_id AND a.status = 'active'
         LEFT JOIN buses b ON a.bus_id = b.bus_id
         LEFT JOIN drivers d ON a.driver_id = d.driver_id
         WHERE t.trip_id = $1`,
        [tripId]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy chuyến xe', 404);
      return success(res, result.rows[0]);
    } catch (err) { next(err); }
  },

  // Tài xế lấy lịch trình chuyến xe của mình trong ngày
  getMyTrips: async (req, res, next) => {
    try {
      // Xác định driver_id liên kết với user
      const driverRes = await pool.query('SELECT driver_id FROM drivers WHERE user_id = $1', [req.user.id]);
      if (!driverRes.rows.length) {
        return error(res, 'Tài khoản này không liên kết với thông tin tài xế', 404);
      }
      const driverId = driverRes.rows[0].driver_id;
      const dateStr = req.query.date || new Date().toISOString().split('T')[0];

      // Get assignment type for the day
      const assignmentRes = await pool.query(
        `SELECT a.assignment_type 
         FROM assignments a
         JOIN operation_plans p ON a.plan_id = p.plan_id
         WHERE a.driver_id = $1 AND p.operation_date = $2 AND p.status = 'approved' AND a.status = 'active'`,
        [driverId, dateStr]
      );
      
      // Check if driver has an approved leave for this date
      const leaveRes = await pool.query(
        "SELECT * FROM leave_requests WHERE driver_id = $1 AND leave_date = $2 AND status = 'approved'",
        [driverId, dateStr]
      );

      let assignmentType = 'off';
      if (leaveRes.rows.length > 0) {
        assignmentType = 'leave';
      } else if (assignmentRes.rows.length > 0) {
        assignmentType = assignmentRes.rows[0].assignment_type;
      }

      const result = await pool.query(
        `SELECT t.*, tg.group_name, rd.direction_type, rd.start_point, rd.end_point, b.bus_id, b.license_plate
         FROM trips t
         JOIN operation_plans p ON t.plan_id = p.plan_id
         JOIN trip_groups tg ON t.group_id = tg.group_id
         JOIN assignments a ON tg.group_id = a.group_id AND a.status = 'active'
         JOIN buses b ON a.bus_id = b.bus_id
         JOIN route_directions rd ON t.direction_id = rd.direction_id
         WHERE a.driver_id = $1 AND p.operation_date = $2 AND p.status = 'approved'
         ORDER BY t.scheduled_departure`,
        [driverId, dateStr]
      );

      return success(res, { assignment_type: assignmentType, trips: result.rows });
    } catch (err) { next(err); }
  },

  // Tài xế ghi nhận xuất bến thực tế (Bắt đầu chuyến)
  startTrip: async (req, res, next) => {
    try {
      const { tripId } = req.params;
      
      // Lấy thông tin chuyến
      const tripRes = await pool.query('SELECT * FROM trips WHERE trip_id = $1', [tripId]);
      if (!tripRes.rows.length) return error(res, 'Không tìm thấy chuyến xe', 404);
      const trip = tripRes.rows[0];

      if (trip.status !== 'scheduled' && trip.status !== 'assigned') {
        return error(res, 'Chuyến xe không ở trạng thái sẵn sàng để xuất bến', 400);
      }

      // Xác nhận tài xế bắt đầu chuyến có đúng là tài xế phân công không
      const driverRes = await pool.query('SELECT driver_id FROM drivers WHERE user_id = $1', [req.user.id]);
      if (!driverRes.rows.length) return error(res, 'Không tìm thấy hồ sơ tài xế', 403);
      const driverId = driverRes.rows[0].driver_id;

      const assignmentRes = await pool.query(
        "SELECT driver_id FROM assignments WHERE group_id = $1 AND status = 'active'",
        [trip.group_id]
      );
      if (!assignmentRes.rows.length || assignmentRes.rows[0].driver_id !== driverId) {
        return error(res, 'Bạn không được phân công chạy chuyến xe này', 403);
      }

      const now = new Date();
      const scheduledDep = new Date(trip.scheduled_departure);
      
      // Tính phút trễ (XL11)
      const diffMs = now - scheduledDep;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const delayMinutes = diffMins > 0 ? diffMins : 0;

      // Cập nhật trạng thái chuyến
      // Luôn chuyển sang running khi xuất bến
      const newStatus = 'running';

      const updateRes = await pool.query(
        `UPDATE trips 
         SET actual_departure = $1, delay_minutes = $2, status = $3 
         WHERE trip_id = $4 
         RETURNING *`,
        [now, delayMinutes, newStatus, tripId]
      );

      // Nếu trễ chuyến, tạo thông báo cho Dispatcher (XL11)
      if (delayMinutes > 0) {
        // Lấy điều phối viên đã tạo kế hoạch
        const planRes = await pool.query(
          `SELECT p.created_by, p.route_code FROM operation_plans p WHERE p.plan_id = $1`,
          [trip.plan_id]
        );
        if (planRes.rows.length) {
          const dispatcherId = planRes.rows[0].created_by;
          const routeCode = planRes.rows[0].route_code;
          await pool.query(
            `INSERT INTO notifications (user_id, title, content) 
             VALUES ($1, 'Cảnh báo trễ chuyến', $2)`,
            [dispatcherId, `Chuyến thứ ${trip.trip_order} (Tuyến ${routeCode}) xuất bến trễ ${delayMinutes} phút.`]
          );
        }
      }

      return success(res, updateRes.rows[0], 'Bắt đầu chuyến xe thành công');
    } catch (err) { next(err); }
  },

  // Tài xế ghi nhận hoàn thành chuyến xe
  finishTrip: async (req, res, next) => {
    try {
      const { tripId } = req.params;

      const tripRes = await pool.query('SELECT * FROM trips WHERE trip_id = $1', [tripId]);
      if (!tripRes.rows.length) return error(res, 'Không tìm thấy chuyến xe', 404);
      const trip = tripRes.rows[0];

      if (trip.status !== 'running') {
        return error(res, 'Chuyến xe chưa bắt đầu hành trình', 400);
      }

      // Xác nhận tài xế
      const driverRes = await pool.query('SELECT driver_id FROM drivers WHERE user_id = $1', [req.user.id]);
      if (!driverRes.rows.length) return error(res, 'Không tìm thấy hồ sơ tài xế', 403);
      const driverId = driverRes.rows[0].driver_id;

      const assignmentRes = await pool.query(
        "SELECT driver_id FROM assignments WHERE group_id = $1 AND status = 'active'",
        [trip.group_id]
      );
      if (!assignmentRes.rows.length || assignmentRes.rows[0].driver_id !== driverId) {
        return error(res, 'Bạn không được phân công chạy chuyến xe này', 403);
      }

      const now = new Date();
      const newStatus = 'completed';
      const updateRes = await pool.query(
        `UPDATE trips 
         SET actual_arrival = $1, status = $2 
         WHERE trip_id = $3 
         RETURNING *`,
        [now, newStatus, tripId]
      );

      return success(res, updateRes.rows[0], 'Hoàn thành chuyến xe thành công');
    } catch (err) { next(err); }
  },

  // Hủy chuyến xe (Dispatcher hủy)
  cancelTrip: async (req, res, next) => {
    try {
      const { tripId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return error(res, 'Vui lòng cung cấp lý do hủy chuyến', 400);
      }

      const tripRes = await pool.query('SELECT * FROM trips WHERE trip_id = $1', [tripId]);
      if (!tripRes.rows.length) return error(res, 'Không tìm thấy chuyến xe', 404);
      const trip = tripRes.rows[0];

      if (trip.status === 'completed' || trip.status === 'cancelled') {
        return error(res, `Không thể hủy chuyến xe ở trạng thái ${trip.status}`, 400);
      }

      const result = await pool.query(
        `UPDATE trips 
         SET status = 'cancelled' 
         WHERE trip_id = $1 
         RETURNING *`,
        [tripId]
      );

      // Tạo thông báo cho tài xế được phân công (nếu có)
      const assignmentRes = await pool.query(
        `SELECT d.user_id 
         FROM assignments a
         JOIN drivers d ON a.driver_id = d.driver_id
         WHERE a.group_id = $1 AND a.status = 'active'`,
        [trip.group_id]
      );

      if (assignmentRes.rows.length) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, content) 
           VALUES ($1, 'Hủy chuyến xe', $2)`,
          [assignmentRes.rows[0].user_id, `Chuyến thứ ${trip.trip_order} trong ca chạy của bạn đã bị hủy. Lý do: ${reason}`]
        );
      }

      return success(res, result.rows[0], 'Hủy chuyến xe thành công');
    } catch (err) { next(err); }
  }
};

module.exports = tripController;
