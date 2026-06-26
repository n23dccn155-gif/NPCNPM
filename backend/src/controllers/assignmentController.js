// assignmentController.js: Nghiệp vụ phân công xe và tài xế theo thiết kế mới
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

// Hàm kiểm tra các điều kiện phân công cho nhóm chuyến (XL07)
async function checkGroupAssignmentConditions(group_id, bus_id, driver_id, excluded_assignment_id = null, is_replacement = false) {
  const issues = [];
  
  // 1. Lấy thông tin nhóm chuyến và kế hoạch
  const groupRes = await pool.query(
    `SELECT g.*, p.operation_date, p.route_code 
     FROM trip_groups g 
     JOIN operation_plans p ON g.plan_id = p.plan_id 
     WHERE g.group_id = $1`, 
    [group_id]
  );
  if (!groupRes.rows.length) return { valid: false, issues: ['Nhóm chuyến không tồn tại'] };
  const group = groupRes.rows[0];
  
  // 2. Kiểm tra trạng thái xe
  const busRes = await pool.query('SELECT * FROM buses WHERE bus_id = $1', [bus_id]);
  if (!busRes.rows.length) return { valid: false, issues: ['Xe không tồn tại'] };
  const bus = busRes.rows[0];
  if (bus.status !== 'active') {
    issues.push(`Xe không hoạt động (trạng thái: ${bus.status})`);
  }
  
  // 3. Kiểm tra xe thuộc tuyến
  const routeBusRes = await pool.query(
    'SELECT * FROM route_buses WHERE route_code = $1 AND bus_id = $2', 
    [group.route_code, bus_id]
  );
  if (!routeBusRes.rows.length) {
    issues.push('Xe không thuộc tuyến này');
  } else {
    const routeBus = routeBusRes.rows[0];
    // Phan cong ban dau chi chon xe operating.
    // Khi thay the, he thong uu tien standby nhung van cho phep operating con ranh trong tuyen.
    if (!is_replacement && routeBus.bus_role !== 'operating') {
      issues.push('Phân công ban đầu chỉ được chọn xe vận doanh (operating)');
    }
  }
  
  // 4. Kiểm tra trạng thái tài xế
  const driverRes = await pool.query('SELECT * FROM drivers WHERE driver_id = $1', [driver_id]);
  if (!driverRes.rows.length) return { valid: false, issues: ['Tài xế không tồn tại'] };
  const driver = driverRes.rows[0];
  if (driver.status !== 'working') {
    issues.push(`Tài xế không ở trạng thái làm việc (trạng thái: ${driver.status})`);
  }
  
  // 5. Kiểm tra tài xế có nghỉ phép đã duyệt không
  const leaveRes = await pool.query(
    `SELECT * FROM leave_requests 
     WHERE driver_id = $1 AND leave_date = $2 AND status = 'approved'`,
    [driver_id, group.operation_date]
  );
  if (leaveRes.rows.length > 0) {
    issues.push('Tài xế đã được duyệt nghỉ phép vào ngày vận hành này');
  }
  
  // 6. Kiểm tra trùng lịch xe
  let busOverlapQuery = `
    SELECT tg.group_id, tg.group_name, tg.start_time, tg.end_time 
    FROM assignments a
    JOIN trip_groups tg ON a.group_id = tg.group_id
    WHERE a.bus_id = $1 AND a.status = 'active' AND tg.group_id != $2
  `;
  const busOverlapParams = [bus_id, group_id];
  if (excluded_assignment_id) {
    busOverlapQuery += ` AND a.assignment_id != $3`;
    busOverlapParams.push(excluded_assignment_id);
  }
  const busOverlapRes = await pool.query(busOverlapQuery, busOverlapParams);
  
  const gStart = new Date(group.start_time);
  const gEnd = new Date(group.end_time);
  
  for (let other of busOverlapRes.rows) {
    const oStart = new Date(other.start_time);
    const oEnd = new Date(other.end_time);
    if (gStart < oEnd && oStart < gEnd) {
      issues.push(`Xe bị trùng lịch với nhóm chuyến ${other.group_name} (${oStart.toLocaleTimeString('vi-VN')} - ${oEnd.toLocaleTimeString('vi-VN')})`);
    }
  }
  
  // 7. Kiểm tra trùng lịch tài xế
  let driverOverlapQuery = `
    SELECT tg.group_id, tg.group_name, tg.start_time, tg.end_time 
    FROM assignments a
    JOIN trip_groups tg ON a.group_id = tg.group_id
    WHERE a.driver_id = $1 AND a.status = 'active' AND tg.group_id != $2
  `;
  const driverOverlapParams = [driver_id, group_id];
  if (excluded_assignment_id) {
    driverOverlapQuery += ` AND a.assignment_id != $3`;
    driverOverlapParams.push(excluded_assignment_id);
  }
  const driverOverlapRes = await pool.query(driverOverlapQuery, driverOverlapParams);
  
  for (let other of driverOverlapRes.rows) {
    const oStart = new Date(other.start_time);
    const oEnd = new Date(other.end_time);
    if (gStart < oEnd && oStart < gEnd) {
      issues.push(`Tài xế bị trùng lịch với nhóm chuyến ${other.group_name} (${oStart.toLocaleTimeString('vi-VN')} - ${oEnd.toLocaleTimeString('vi-VN')})`);
    }
  }
  
  return { valid: issues.length === 0, issues, group };
}

const assignmentController = {
  // Lấy danh sách phân công
  getAll: async (req, res, next) => {
    try {
      const { plan_id, status } = req.query;
      let query = `
        SELECT a.*, tg.group_name, tg.start_time, tg.end_time, 
               b.license_plate, d.full_name as driver_name, 
               u.full_name as assigned_by_name,
               p.route_code, p.operation_date
        FROM assignments a
        JOIN trip_groups tg ON a.group_id = tg.group_id
        JOIN operation_plans p ON tg.plan_id = p.plan_id
        JOIN buses b ON a.bus_id = b.bus_id
        JOIN drivers d ON a.driver_id = d.driver_id
        JOIN users u ON a.assigned_by = u.user_id
      `;
      const params = [];
      const conditions = [];
      if (plan_id) {
        conditions.push(`tg.plan_id = $${params.length + 1}`);
        params.push(plan_id);
      }
      if (status) {
        conditions.push(`a.status = $${params.length + 1}`);
        params.push(status);
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY a.assignment_id DESC';
      
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Phân công xe và tài xế ban đầu cho nhóm chuyến (XL07)
  assignGroup: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { group_id, bus_id, driver_id } = req.body;
      const dispatcher_id = req.user.id;

      if (!group_id || !bus_id || !driver_id) {
        await client.query('ROLLBACK');
        return error(res, 'Vui lòng cung cấp đầy đủ group_id, bus_id và driver_id', 400);
      }

      // Kiểm tra xem nhóm đã có phân công active chưa
      const existing = await client.query(
        "SELECT assignment_id FROM assignments WHERE group_id = $1 AND status = 'active'",
        [group_id]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return error(res, 'Nhóm chuyến này đã được phân công. Vui lòng sử dụng chức năng điều chỉnh/thay thế.', 409);
      }

      // Kiểm tra các điều kiện phân công
      const check = await checkGroupAssignmentConditions(group_id, bus_id, driver_id, null, false);
      if (!check.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Phân công không hợp lệ', issues: check.issues });
      }

      // Tạo bản ghi assignments
      const result = await client.query(
        `INSERT INTO assignments (group_id, bus_id, driver_id, assigned_by, status) 
         VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
        [group_id, bus_id, driver_id, dispatcher_id]
      );

      // Cập nhật trạng thái nhóm chuyến
      await client.query("UPDATE trip_groups SET status = 'assigned' WHERE group_id = $1", [group_id]);

      // Cập nhật trạng thái tất cả các chuyến trong nhóm
      await client.query("UPDATE trips SET status = 'assigned' WHERE group_id = $1", [group_id]);

      await client.query('COMMIT');
      
      try {
        const { emitToUser } = require('../sockets/socketManager');
        const driverUser = await pool.query("SELECT user_id FROM drivers WHERE driver_id = $1", [driver_id]);
        if (driverUser.rows.length) {
          const content = `Bạn vừa được phân công một lịch chạy mới.`;
          await pool.query(
            `INSERT INTO notifications (user_id, title, content) VALUES ($1, 'Phân công mới', $2)`,
            [driverUser.rows[0].user_id, content]
          );
          emitToUser(driverUser.rows[0].user_id, 'NEW_NOTIFICATION', { title: 'Phân công mới', content });
        }
      } catch (e) { console.error('Socket error:', e); }
      return success(res, result.rows[0], 'Phân công xe và tài xế thành công', 201);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  // Thay tài xế khác khi tài xế nghỉ phép (XL13)
  replaceDriver: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { group_id, new_driver_id } = req.body;
      const dispatcher_id = req.user.id;

      if (!group_id || !new_driver_id) {
        await client.query('ROLLBACK');
        return error(res, 'Vui lòng cung cấp group_id và tài xế thay thế', 400);
      }

      // Lấy phân công active hiện tại
      const activeRes = await client.query(
        "SELECT * FROM assignments WHERE group_id = $1 AND status = 'active'",
        [group_id]
      );
      if (!activeRes.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Nhóm chuyến này chưa có phân công nào trước đó để thay thế', 404);
      }
      const oldAssignment = activeRes.rows[0];

      // Kiểm tra xem có chuyến nào chưa bắt đầu không. Chỉ thay thế khi còn chuyến chưa chạy.
      const affectedTrips = await client.query(
        `SELECT trip_id FROM trips 
         WHERE group_id = $1 AND actual_departure IS NULL 
           AND status NOT IN ('completed', 'cancelled')`,
        [group_id]
      );
      if (!affectedTrips.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Không có chuyến chưa bắt đầu nào cần thay tài xế', 400);
      }

      // Kiểm tra điều kiện cho tài xế mới
      const check = await checkGroupAssignmentConditions(group_id, oldAssignment.bus_id, new_driver_id, oldAssignment.assignment_id, true);
      if (!check.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Tài xế thay thế không hợp lệ', issues: check.issues });
      }

      // Chuyển trạng thái phân công cũ thành replaced
      await client.query(
        "UPDATE assignments SET status = 'replaced' WHERE assignment_id = $1",
        [oldAssignment.assignment_id]
      );

      // Tạo phân công mới
      const result = await client.query(
        `INSERT INTO assignments (group_id, bus_id, driver_id, assigned_by, status) 
         VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
        [group_id, oldAssignment.bus_id, new_driver_id, dispatcher_id]
      );

      // Gửi thông báo cho tài xế mới và cũ
      const planRes = await client.query(
        `SELECT p.operation_date, p.route_code FROM trip_groups g JOIN operation_plans p ON g.plan_id = p.plan_id WHERE g.group_id = $1`,
        [group_id]
      );
      const dateStr = planRes.rows[0].operation_date.toISOString().split('T')[0];

      const oldDriverUser = await client.query("SELECT user_id FROM drivers WHERE driver_id = $1", [oldAssignment.driver_id]);
      const newDriverUser = await client.query("SELECT user_id FROM drivers WHERE driver_id = $1", [new_driver_id]);

      if (oldDriverUser.rows.length) {
        const content = `Lịch phân công ngày ${dateStr} của bạn đã được chuyển cho tài xế khác.`;
        await client.query(
          `INSERT INTO notifications (user_id, title, content) 
           VALUES ($1, 'Thay đổi lịch phân công', $2)`,
          [oldDriverUser.rows[0].user_id, content]
        );
        const { emitToUser } = require('../sockets/socketManager');
        emitToUser(oldDriverUser.rows[0].user_id, 'NEW_NOTIFICATION', { title: 'Thay đổi lịch phân công', content });
      }
      if (newDriverUser.rows.length) {
        const content = `Bạn được phân công thay thế cho ngày ${dateStr}.`;
        await client.query(
          `INSERT INTO notifications (user_id, title, content) 
           VALUES ($1, 'Lịch phân công thay thế', $2)`,
          [newDriverUser.rows[0].user_id, content]
        );
        const { emitToUser } = require('../sockets/socketManager');
        emitToUser(newDriverUser.rows[0].user_id, 'NEW_NOTIFICATION', { title: 'Lịch phân công thay thế', content });
      }

      // Gửi thông báo cho Quản lý vận hành
      const managers = await client.query("SELECT user_id FROM users WHERE role = 'manager' AND status = 'active'");
      const { broadcast } = require('../sockets/socketManager');
      for (let mgr of managers.rows) {
        const content = `Điều phối đã thay đổi tài xế cho nhóm chuyến ${check.group.group_name} ngày ${dateStr}.`;
        await client.query(
          `INSERT INTO notifications (user_id, title, content) 
           VALUES ($1, 'Thay đổi tài xế', $2)`,
          [mgr.user_id, content]
        );
      }
      broadcast('NEW_NOTIFICATION', { title: 'Thay đổi tài xế', content: `Điều phối đã thay đổi tài xế ngày ${dateStr}.` });

      await client.query('COMMIT');
      return success(res, result.rows[0], 'Thay thế tài xế thành công');
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  // Thay xe khi xe hong: uu tien xe standby, co the chon xe operating con ranh trong tuyen.
  replaceBus: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { group_id, new_bus_id } = req.body;
      const dispatcher_id = req.user.id;

      if (!group_id || !new_bus_id) {
        await client.query('ROLLBACK');
        return error(res, 'Vui lòng cung cấp group_id và xe thay thế', 400);
      }

      // Lấy phân công active hiện tại
      const activeRes = await client.query(
        "SELECT * FROM assignments WHERE group_id = $1 AND status = 'active'",
        [group_id]
      );
      if (!activeRes.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Nhóm chuyến này chưa có phân công nào trước đó để thay thế', 404);
      }
      const oldAssignment = activeRes.rows[0];

      // Kiểm tra xe thay thế có hợp lệ không
      const check = await checkGroupAssignmentConditions(group_id, new_bus_id, oldAssignment.driver_id, oldAssignment.assignment_id, true);
      if (!check.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Xe thay thế không hợp lệ', issues: check.issues });
      }

      // Chuyển phân công cũ sang replaced
      await client.query(
        "UPDATE assignments SET status = 'replaced' WHERE assignment_id = $1",
        [oldAssignment.assignment_id]
      );

      // Tạo phân công mới
      const result = await client.query(
        `INSERT INTO assignments (group_id, bus_id, driver_id, assigned_by, status) 
         VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
        [group_id, new_bus_id, oldAssignment.driver_id, dispatcher_id]
      );

      // Gửi thông báo cho tài xế và Quản lý
      const planRes = await client.query(
        `SELECT p.operation_date, p.route_code FROM trip_groups g JOIN operation_plans p ON g.plan_id = p.plan_id WHERE g.group_id = $1`,
        [group_id]
      );
      const dateStr = planRes.rows[0].operation_date.toISOString().split('T')[0];

      const driverUser = await client.query("SELECT user_id FROM drivers WHERE driver_id = $1", [oldAssignment.driver_id]);
      if (driverUser.rows.length) {
        const content = `Xe phân công ngày ${dateStr} của bạn đã được đổi sang xe khác do sự cố.`;
        await client.query(
          `INSERT INTO notifications (user_id, title, content) 
           VALUES ($1, 'Thay đổi xe phân công', $2)`,
          [driverUser.rows[0].user_id, content]
        );
        const { emitToUser } = require('../sockets/socketManager');
        emitToUser(driverUser.rows[0].user_id, 'NEW_NOTIFICATION', { title: 'Thay đổi xe phân công', content });
      }

      const managers = await client.query("SELECT user_id FROM users WHERE role = 'manager' AND status = 'active'");
      const { broadcast } = require('../sockets/socketManager');
      for (let mgr of managers.rows) {
        const content = `Điều phối đã thay đổi xe vận doanh cho nhóm chuyến ${check.group.group_name} ngày ${dateStr}.`;
        await client.query(
          `INSERT INTO notifications (user_id, title, content) 
           VALUES ($1, 'Thay đổi xe vận hành', $2)`,
          [mgr.user_id, content]
        );
      }
      broadcast('NEW_NOTIFICATION', { title: 'Thay đổi xe vận hành', content: `Điều phối đã thay đổi xe ngày ${dateStr}.` });

      await client.query('COMMIT');
      return success(res, result.rows[0], 'Thay thế xe thành công');
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  // Tìm danh sách xe và tài xế khả dụng (không bị trùng lịch và đủ điều kiện) cho nhóm chuyến
  getAvailableResources: async (req, res, next) => {
    try {
      const { groupId } = req.params;

      // Lấy thông tin nhóm chuyến
      const groupRes = await pool.query(
        `SELECT g.*, p.operation_date, p.route_code 
         FROM trip_groups g 
         JOIN operation_plans p ON g.plan_id = p.plan_id 
         WHERE g.group_id = $1`,
        [groupId]
      );
      if (!groupRes.rows.length) {
        return error(res, 'Không tìm thấy nhóm chuyến', 404);
      }
      const group = groupRes.rows[0];

      const { is_replacement } = req.query;
      const isReplacement = is_replacement === 'true';

      // 1. Xe khả dụng: active, thuộc tuyến route_code
      let busQuery = `
         SELECT b.bus_id, b.license_plate, b.seat_count, rb.bus_role
         FROM buses b
         JOIN route_buses rb ON b.bus_id = rb.bus_id
         WHERE rb.route_code = $1 AND b.status = 'active'
      `;
      if (!isReplacement) {
        busQuery += ` AND rb.bus_role = 'operating' ORDER BY b.license_plate`;
      } else {
        busQuery += ` ORDER BY rb.bus_role DESC, b.license_plate`; // 'standby' > 'operating' (s > o)
      }

      const busesRes = await pool.query(busQuery, [group.route_code]);

      // Lọc các xe bị trùng lịch hoặc đã được phân công trong ngày này
      const availableBuses = [];
      for (let bus of busesRes.rows) {
        const overlap = await pool.query(
          `SELECT tg.group_name 
           FROM assignments a
           JOIN trip_groups tg ON a.group_id = tg.group_id
           JOIN operation_plans p ON tg.plan_id = p.plan_id
           WHERE a.bus_id = $1 AND a.status = 'active' 
             AND p.operation_date = $2
             AND tg.group_id != $3`,
          [bus.bus_id, group.operation_date, groupId]
        );
        if (overlap.rows.length === 0) {
          availableBuses.push(bus);
        }
      }

      // 2. Tài xế khả dụng: working, không xin nghỉ vào ngày vận hành này
      const driversRes = await pool.query(
        `SELECT d.driver_id, d.full_name, d.phone, d.license_class
         FROM drivers d
         WHERE d.status = 'working'
           AND NOT EXISTS (
             SELECT 1 FROM leave_requests l 
             WHERE l.driver_id = d.driver_id 
               AND l.leave_date = $1 
               AND l.status = 'approved'
           )
         ORDER BY d.full_name`,
        [group.operation_date]
      );

      // Lọc các tài xế bị trùng lịch hoặc đã được phân công trong ngày này
      const availableDrivers = [];
      for (let driver of driversRes.rows) {
        const overlap = await pool.query(
          `SELECT tg.group_name 
           FROM assignments a
           JOIN trip_groups tg ON a.group_id = tg.group_id
           JOIN operation_plans p ON tg.plan_id = p.plan_id
           WHERE a.driver_id = $1 AND a.status = 'active' 
             AND p.operation_date = $2
             AND tg.group_id != $3`,
          [driver.driver_id, group.operation_date, groupId]
        );
        if (overlap.rows.length === 0) {
          availableDrivers.push(driver);
        }
      }

      return success(res, { buses: availableBuses, drivers: availableDrivers });
    } catch (err) { next(err); }
  }
};

module.exports = assignmentController;
