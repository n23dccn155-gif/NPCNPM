// tripController.js: Nghiệp vụ ghi nhận hành trình chuyến xe (XL10, XL11) theo thiết kế mới
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');
const { emitToUser, broadcast } = require('../sockets/socketManager');

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
      
      const tripRes = await pool.query('SELECT * FROM trips WHERE trip_id = $1', [tripId]);
      if (!tripRes.rows.length) return error(res, 'Không tìm thấy chuyến xe', 404);
      const trip = tripRes.rows[0];

      if (trip.status !== 'scheduled' && trip.status !== 'assigned') {
        return error(res, 'Chuyến xe không ở trạng thái sẵn sàng để xuất bến', 400);
      }

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
      const diffMs = now - scheduledDep;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const delayMinutes = diffMins > 0 ? diffMins : 0;

      const newStatus = 'running';
      const updateRes = await pool.query(
        `UPDATE trips 
         SET actual_departure = $1, delay_minutes = $2, status = $3 
         WHERE trip_id = $4 
         RETURNING *`,
        [now, delayMinutes, newStatus, tripId]
      );

      // --- Thông báo chi tiết ---
      try {
        // Lấy thông tin bổ sung
        const groupInfo = await pool.query(
          `SELECT tg.group_name, p.route_code, p.created_by as dispatcher_id
           FROM trip_groups tg
           JOIN operation_plans p ON tg.plan_id = p.plan_id
           WHERE tg.group_id = $1`,
          [trip.group_id]
        );
<<<<<<< HEAD
        const groupName = groupInfo.rows[0]?.group_name || 'không xác định';
        const routeCode = groupInfo.rows[0]?.route_code || 'không xác định';
        const dispatcherId = groupInfo.rows[0]?.dispatcher_id;

        const driverInfo = await pool.query(
          'SELECT full_name FROM drivers WHERE driver_id = $1',
          [driverId]
        );
        const driverName = driverInfo.rows[0]?.full_name || 'không xác định';

        const busInfo = await pool.query(
          'SELECT license_plate FROM buses WHERE bus_id = (SELECT bus_id FROM assignments WHERE group_id = $1 AND status = $2)',
          [trip.group_id, 'active']
        );
        const licensePlate = busInfo.rows[0]?.license_plate || 'không xác định';

        // Nếu trễ chuyến (XL11) - thông báo cho dispatcher và manager
        if (delayMinutes > 0) {
          const content = `Chuyến thứ ${trip.trip_order} (Tuyến ${routeCode}, Xe ${licensePlate}, Tài xế ${driverName}) xuất bến trễ ${delayMinutes} phút so với kế hoạch.`;
          
          // Gửi cho dispatcher
          if (dispatcherId) {
            await pool.query(
              `INSERT INTO notifications (user_id, title, content) 
               VALUES ($1, 'Cảnh báo trễ chuyến', $2)`,
              [dispatcherId, content]
            );
            emitToUser(dispatcherId, 'NEW_NOTIFICATION', { title: 'Cảnh báo trễ chuyến', content });
          }

          // Gửi cho tất cả manager
          const managers = await pool.query("SELECT user_id FROM users WHERE role = 'manager' AND status = 'active'");
          for (let mgr of managers.rows) {
            await pool.query(
              `INSERT INTO notifications (user_id, title, content) VALUES ($1, 'Cảnh báo trễ chuyến', $2)`,
              [mgr.user_id, content]
            );
          }
          broadcast('NEW_NOTIFICATION', { title: 'Cảnh báo trễ chuyến', content });
        } else {
          // Nếu đúng giờ, thông báo nhẹ cho dispatcher và manager
          const content = `Chuyến thứ ${trip.trip_order} (Tuyến ${routeCode}, Xe ${licensePlate}, Tài xế ${driverName}) đã xuất bến đúng giờ.`;
          
          if (dispatcherId) {
            await pool.query(
              `INSERT INTO notifications (user_id, title, content) 
               VALUES ($1, 'Chuyến đã xuất bến', $2)`,
              [dispatcherId, content]
            );
            emitToUser(dispatcherId, 'NEW_NOTIFICATION', { title: 'Chuyến đã xuất bến', content });
          }

          const managers = await pool.query("SELECT user_id FROM users WHERE role = 'manager' AND status = 'active'");
          for (let mgr of managers.rows) {
            await pool.query(
              `INSERT INTO notifications (user_id, title, content) VALUES ($1, 'Chuyến đã xuất bến', $2)`,
              [mgr.user_id, content]
            );
          }
          broadcast('NEW_NOTIFICATION', { title: 'Chuyến đã xuất bến', content });
=======
        if (planRes.rows.length) {
          const dispatcherId = planRes.rows[0].created_by;
          const routeCode = planRes.rows[0].route_code;
          await pool.query(
            `INSERT INTO notifications (user_id, title, content, redirect_url) 
             VALUES ($1, 'Cảnh báo trễ chuyến', $2, '/dispatcher/calendar')`,
            [dispatcherId, `Chuyến thứ ${trip.trip_order} (Tuyến ${routeCode}) xuất bến trễ ${delayMinutes} phút.`]
          );
>>>>>>> ed64ea497b8925f8778ff9f6b7f8fbdbff782002
        }
      } catch (e) { console.error('Notification error:', e); }

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

      // --- Thông báo hoàn thành chuyến ---
      try {
        const groupInfo = await pool.query(
          `SELECT tg.group_name, p.route_code, p.created_by as dispatcher_id
           FROM trip_groups tg
           JOIN operation_plans p ON tg.plan_id = p.plan_id
           WHERE tg.group_id = $1`,
          [trip.group_id]
        );
        const groupName = groupInfo.rows[0]?.group_name || 'không xác định';
        const routeCode = groupInfo.rows[0]?.route_code || 'không xác định';
        const dispatcherId = groupInfo.rows[0]?.dispatcher_id;

        const driverInfo = await pool.query(
          'SELECT full_name FROM drivers WHERE driver_id = $1',
          [driverId]
        );
        const driverName = driverInfo.rows[0]?.full_name || 'không xác định';

        const busInfo = await pool.query(
          'SELECT license_plate FROM buses WHERE bus_id = (SELECT bus_id FROM assignments WHERE group_id = $1 AND status = $2)',
          [trip.group_id, 'active']
        );
        const licensePlate = busInfo.rows[0]?.license_plate || 'không xác định';

        const content = `Chuyến thứ ${trip.trip_order} (Tuyến ${routeCode}, Xe ${licensePlate}, Tài xế ${driverName}) đã hoàn thành hành trình.`;

        if (dispatcherId) {
          await pool.query(
            `INSERT INTO notifications (user_id, title, content) 
             VALUES ($1, 'Chuyến hoàn thành', $2)`,
            [dispatcherId, content]
          );
          emitToUser(dispatcherId, 'NEW_NOTIFICATION', { title: 'Chuyến hoàn thành', content });
        }

        const managers = await pool.query("SELECT user_id FROM users WHERE role = 'manager' AND status = 'active'");
        for (let mgr of managers.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, title, content) VALUES ($1, 'Chuyến hoàn thành', $2)`,
            [mgr.user_id, content]
          );
        }
        broadcast('NEW_NOTIFICATION', { title: 'Chuyến hoàn thành', content });
      } catch (e) { console.error('Notification error:', e); }

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

<<<<<<< HEAD
      // --- Thông báo hủy chuyến ---
      try {
        // Lấy thông tin chi tiết
        const groupInfo = await pool.query(
          `SELECT tg.group_name, p.route_code, p.created_by as dispatcher_id
           FROM trip_groups tg
           JOIN operation_plans p ON tg.plan_id = p.plan_id
           WHERE tg.group_id = $1`,
          [trip.group_id]
=======
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
          `INSERT INTO notifications (user_id, title, content, redirect_url) 
           VALUES ($1, 'Hủy chuyến xe', $2, '/driver/schedule')`,
          [assignmentRes.rows[0].user_id, `Chuyến thứ ${trip.trip_order} trong ca chạy của bạn đã bị hủy. Lý do: ${reason}`]
>>>>>>> ed64ea497b8925f8778ff9f6b7f8fbdbff782002
        );
        const groupName = groupInfo.rows[0]?.group_name || 'không xác định';
        const routeCode = groupInfo.rows[0]?.route_code || 'không xác định';
        const dispatcherId = groupInfo.rows[0]?.dispatcher_id;

        // Thông báo cho tài xế được phân công
        const assignmentRes = await pool.query(
          `SELECT d.user_id, d.full_name
           FROM assignments a
           JOIN drivers d ON a.driver_id = d.driver_id
           WHERE a.group_id = $1 AND a.status = 'active'`,
          [trip.group_id]
        );

        if (assignmentRes.rows.length) {
          const driverName = assignmentRes.rows[0].full_name;
          const content = `Chuyến thứ ${trip.trip_order} (Tuyến ${routeCode}) trong ca chạy của bạn đã bị hủy. Lý do: ${reason}`;
          await pool.query(
            `INSERT INTO notifications (user_id, title, content) 
             VALUES ($1, 'Hủy chuyến xe', $2)`,
            [assignmentRes.rows[0].user_id, content]
          );
          emitToUser(assignmentRes.rows[0].user_id, 'NEW_NOTIFICATION', {
            title: 'Hủy chuyến xe',
            content
          });
        }

        // Thông báo cho dispatcher (người hủy)
        if (dispatcherId) {
          const content = `Chuyến thứ ${trip.trip_order} (Tuyến ${routeCode}) đã bị hủy bởi bạn. Lý do: ${reason}`;
          await pool.query(
            `INSERT INTO notifications (user_id, title, content) 
             VALUES ($1, 'Hủy chuyến xe', $2)`,
            [dispatcherId, content]
          );
          emitToUser(dispatcherId, 'NEW_NOTIFICATION', { title: 'Hủy chuyến xe', content });
        }

        // Thông báo cho tất cả manager
        const managers = await pool.query("SELECT user_id FROM users WHERE role = 'manager' AND status = 'active'");
        const managerContent = `Chuyến thứ ${trip.trip_order} (Tuyến ${routeCode}) đã bị hủy. Lý do: ${reason}`;
        for (let mgr of managers.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, title, content) VALUES ($1, 'Hủy chuyến xe', $2)`,
            [mgr.user_id, managerContent]
          );
        }
        broadcast('NEW_NOTIFICATION', { title: 'Hủy chuyến xe', content: managerContent });
      } catch (e) { console.error('Notification error:', e); }

      return success(res, result.rows[0], 'Hủy chuyến xe thành công');
    } catch (err) { next(err); }
  }
};

module.exports = tripController;