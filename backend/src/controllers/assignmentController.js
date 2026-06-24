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
      return success(res, result.rows[0], 'Phân công xe và tài xế thành công', 201);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  // Xóa tài xế khỏi phân công (khi nghỉ phép hoặc muốn trống)
  clearDriver: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { groupId } = req.params;

      const activeRes = await client.query(
        "SELECT * FROM assignments WHERE group_id = $1 AND status = 'active'",
        [groupId]
      );
      
      if (!activeRes.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Nhóm chuyến này chưa có phân công nào để gỡ', 404);
      }

      await client.query(
        "UPDATE assignments SET status = 'replaced' WHERE assignment_id = $1",
        [activeRes.rows[0].assignment_id]
      );

      // Cập nhật group status thành unassigned
      await client.query("UPDATE trip_groups SET status = 'unassigned' WHERE group_id = $1", [groupId]);
      await client.query("UPDATE trips SET status = 'scheduled' WHERE group_id = $1", [groupId]);

      await client.query('COMMIT');
      return success(res, null, 'Đã gỡ tài xế khỏi nhóm chuyến thành công');
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
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp group_id và tài xế thay thế' });
      }

      const activeRes = await client.query("SELECT * FROM assignments WHERE group_id = $1 AND status = 'active'", [group_id]);
      let oldAssignment = null;
      let bus_id_to_assign = null;
      let plan_id_to_assign = null;

      if (activeRes.rows.length) {
        oldAssignment = activeRes.rows[0];
        bus_id_to_assign = oldAssignment.bus_id;
        plan_id_to_assign = oldAssignment.plan_id;
      } else {
        const groupRes = await client.query("SELECT plan_id FROM trip_groups WHERE group_id = $1", [group_id]);
        if (!groupRes.rows.length) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, message: 'Nhóm chuyến không tồn tại' });
        }
        plan_id_to_assign = groupRes.rows[0].plan_id;
        const lastAssign = await client.query("SELECT bus_id FROM assignments WHERE group_id = $1 ORDER BY assignment_id DESC LIMIT 1", [group_id]);
        if (lastAssign.rows.length) {
          bus_id_to_assign = lastAssign.rows[0].bus_id;
        } else {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, message: 'Nhóm chuyến này chưa từng phân công' });
        }
      }

      const check = await checkGroupAssignmentConditions(group_id, bus_id_to_assign, new_driver_id, oldAssignment ? oldAssignment.assignment_id : null, true);
      if (!check.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Tài xế thay thế không hợp lệ', issues: check.issues });
      }

      if (oldAssignment) {
        await client.query("UPDATE assignments SET status = 'replaced' WHERE assignment_id = $1", [oldAssignment.assignment_id]);
      }

      await client.query("UPDATE assignments SET status = 'replaced' WHERE driver_id = $1 AND plan_id = $2 AND status = 'active' AND assignment_type LIKE 'standby%'", [new_driver_id, plan_id_to_assign]);

      const result = await client.query("INSERT INTO assignments (plan_id, group_id, bus_id, driver_id, assignment_type, assigned_by, status) VALUES ($1, $2, $3, $4, 'main', $5, 'active') RETURNING *", [plan_id_to_assign, group_id, bus_id_to_assign, new_driver_id, dispatcher_id]);
      await client.query("UPDATE trip_groups SET status = 'assigned' WHERE group_id = $1", [group_id]);
      await client.query("UPDATE trips SET status = 'assigned' WHERE group_id = $1", [group_id]);
      
      // Gửi thông báo cho tài xế mới được kéo vào
      const newDriverUserRes = await client.query('SELECT user_id FROM drivers WHERE driver_id = $1', [new_driver_id]);
      if (newDriverUserRes.rows.length > 0) {
        const newDriverUserId = newDriverUserRes.rows[0].user_id;
        const groupRes = await client.query('SELECT group_name FROM trip_groups WHERE group_id = $1', [group_id]);
        const groupName = groupRes.rows.length ? groupRes.rows[0].group_name : '';
        
        await client.query(
          `INSERT INTO notifications (user_id, title, content) VALUES ($1, $2, $3)`,
          [newDriverUserId, 'Phân công lại ca chạy', `Bạn đã được điều phối viên chuyển từ vị trí dự bị sang chạy chính thức cho Nhóm chuyến ${groupName}. Vui lòng kiểm tra lịch trình của mình!`]
        );
      }

      await client.query('COMMIT');
      return res.status(200).json({ success: true, data: result.rows[0], message: 'Thay thế tài xế thành công' });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  // Thay xe
  replaceBus: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { group_id, new_bus_id } = req.body;
      const dispatcher_id = req.user.id;

      if (!group_id || !new_bus_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp group_id và xe thay thế' });
      }

      const activeRes = await client.query("SELECT * FROM assignments WHERE group_id = $1 AND status = 'active'", [group_id]);
      if (!activeRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Chưa có phân công nào' });
      }
      const oldAssignment = activeRes.rows[0];

      const check = await checkGroupAssignmentConditions(group_id, new_bus_id, oldAssignment.driver_id, oldAssignment.assignment_id, true);
      if (!check.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Xe thay thế không hợp lệ', issues: check.issues });
      }

      await client.query("UPDATE assignments SET status = 'replaced' WHERE assignment_id = $1", [oldAssignment.assignment_id]);
      const result = await client.query("INSERT INTO assignments (plan_id, group_id, bus_id, driver_id, assignment_type, assigned_by, status) VALUES ($1, $2, $3, $4, 'main', $5, 'active') RETURNING *", [oldAssignment.plan_id, group_id, new_bus_id, oldAssignment.driver_id, dispatcher_id]);
      
      await client.query('COMMIT');
      return res.status(200).json({ success: true, data: result.rows[0], message: 'Thay thế xe thành công' });
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
  },

  autoAssignPlan: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { planId } = req.params;
      console.log('autoAssignPlan req keys:', Object.keys(req));
      console.log('autoAssignPlan req.body:', req.body);
      const { standbyRatio = 0.15 } = req.body || {};
      const dispatcherId = req.user.id;

      const planRes = await client.query('SELECT * FROM operation_plans WHERE plan_id = $1', [planId]);
      if (!planRes.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Không tìm thấy kế hoạch', 404);
      }
      const plan = planRes.rows[0];

      const groupsRes = await client.query(
        "SELECT * FROM trip_groups WHERE plan_id = $1 AND status = 'unassigned' ORDER BY group_name, start_time",
        [planId]
      );
      if (!groupsRes.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Không có nhóm chuyến nào cần phân công (hoặc đã phân công hết)', 400);
      }
      const groups = groupsRes.rows;

      const vehicleGroupsMap = {};
      groups.forEach(g => {
         const baseName = g.group_name.split(' - ')[0];
         if(!vehicleGroupsMap[baseName]) vehicleGroupsMap[baseName] = [];
         vehicleGroupsMap[baseName].push(g);
      });

      const requiredBuses = Object.keys(vehicleGroupsMap).length;
      const requiredMainDrivers = groups.length;
      const requiredStandbyDrivers = Math.ceil(requiredMainDrivers * standbyRatio);
      const totalDriversNeeded = requiredMainDrivers + requiredStandbyDrivers;
      const minWeeklyDrivers = Math.ceil((totalDriversNeeded * 7) / 6);

      // Check total route drivers first (Validation for rotation policy)
      const totalRouteDriversRes = await client.query(
        `SELECT COUNT(rd.driver_id) FROM route_drivers rd
         JOIN drivers d ON rd.driver_id = d.driver_id
         WHERE rd.route_code = $1 AND rd.status = 'active' AND d.status = 'working'`,
        [plan.route_code]
      );
      const totalRouteDrivers = parseInt(totalRouteDriversRes.rows[0].count);

      if (totalRouteDrivers < minWeeklyDrivers) {
         await client.query('ROLLBACK');
         return error(res, `Tuyến không đủ tài xế để xoay vòng ca (đảm bảo nghỉ 1 ngày/tuần). Yêu cầu tối thiểu ${minWeeklyDrivers} tài xế, nhưng tuyến chỉ có ${totalRouteDrivers}.`, 400);
      }

      const routeRow = await client.query('SELECT min_rest_time_minutes FROM routes WHERE route_code = $1', [plan.route_code]);
      const minRestTime = routeRow.rows[0]?.min_rest_time_minutes || 60;

      const busesRes = await client.query(
        `SELECT b.bus_id FROM buses b
         JOIN route_buses rb ON b.bus_id = rb.bus_id
         WHERE rb.route_code = $1 AND b.status = 'active'`,
        [plan.route_code]
      );
      const availableBuses = busesRes.rows.map(b => b.bus_id);

      const driversRes = await client.query(
        `SELECT rd.driver_id,

                COALESCE(
                  (SELECT ($2::date - dDate::date) - 1
                   FROM generate_series($2::date - INTERVAL '30 days', $2::date - INTERVAL '1 day', '1 day') AS dDate
                   WHERE NOT EXISTS (
                     SELECT 1 FROM assignments a 
                     JOIN operation_plans p ON a.plan_id = p.plan_id
                     WHERE a.driver_id = rd.driver_id AND p.operation_date = dDate::date AND a.status = 'active'
                   )
                   ORDER BY dDate DESC LIMIT 1), 
                  30
                ) AS consecutive_shifts
         FROM route_drivers rd
         JOIN drivers d ON rd.driver_id = d.driver_id
         WHERE rd.route_code = $1 
           AND rd.status = 'active'
           AND d.status = 'working'
           AND NOT EXISTS (
             SELECT 1 FROM leave_requests l 
             WHERE l.driver_id = d.driver_id AND l.leave_date = $2 AND l.status = 'approved'
           )
         ORDER BY consecutive_shifts ASC, 
                  ((rd.driver_id + (SELECT extract(epoch FROM $2::date)/86400/7)::int) % (SELECT COUNT(*) FROM route_drivers WHERE route_code=$1 AND status='active')) ASC`,
        [plan.route_code, plan.operation_date]
      );
      
      const availableDrivers = [];
      for (const d of driversRes.rows) {
        const overlap = await client.query(
          `SELECT 1 FROM assignments a
           WHERE a.driver_id = $1 AND a.status = 'active' AND a.plan_id = $2`,
          [d.driver_id, plan.plan_id]
        );
        if (overlap.rows.length === 0) {
          availableDrivers.push(d.driver_id);
        }
      }

      if (availableBuses.length < requiredBuses) {
         await client.query('ROLLBACK');
         return error(res, `Tuyến thiếu xe. Yêu cầu tối thiểu ${requiredBuses} xe vận doanh, hiện có ${availableBuses.length} tổng xe.`, 400);
      }
      if (availableDrivers.length < totalDriversNeeded) {
         await client.query('ROLLBACK');
         return error(res, `Tuyến thiếu tài xế. Yêu cầu ${totalDriversNeeded} (Chính: ${requiredMainDrivers}, Dự bị: ${requiredStandbyDrivers}), hiện có ${availableDrivers.length}`, 400);
      }

      const workingDrivers = availableDrivers.slice(0, totalDriversNeeded);

      const assignmentsToMake = [];
      
      const busState = availableBuses.map(bus_id => ({
          bus_id,
          availableTime: 0,
          shiftCount: 0
      }));

      function timeToMinutes(dateObj) {
          if (!dateObj) return 0;
          return dateObj.getHours() * 60 + dateObj.getMinutes();
      }

      // Sort groups by start_time
      const sortedGroups = [...groups].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      for (const g of sortedGroups) {
          const startMin = timeToMinutes(new Date(g.start_time));
          const endMin = timeToMinutes(new Date(g.end_time));

          let candidateBuses = busState.filter(b => b.availableTime <= startMin);
          if (candidateBuses.length === 0) {
              candidateBuses = busState; // Fallback: Take the one that will be available soonest
          }

          candidateBuses.sort((a, b) => {
              if (a.availableTime !== b.availableTime) return a.availableTime - b.availableTime;
              return a.shiftCount - b.shiftCount;
          });

          const selectedBus = candidateBuses[0];

          assignmentsToMake.push({
             type: 'main',
             group_id: g.group_id,
             bus_id: selectedBus.bus_id,
             start_time: g.start_time
          });

          selectedBus.shiftCount += 1;
          selectedBus.availableTime = endMin + minRestTime;
      }

      const baseDateStr = plan.operation_date instanceof Date 
            ? plan.operation_date.toISOString().split('T')[0] 
            : new Date(plan.operation_date).toISOString().split('T')[0];

      let earliestMainTime = new Date();
      if (assignmentsToMake.length > 0) {
         let earliest = assignmentsToMake[0].start_time;
         for (const a of assignmentsToMake) {
             if (a.start_time < earliest) earliest = a.start_time;
         }
         earliestMainTime = earliest;
      }

      for (let i = 0; i < requiredStandbyDrivers; i++) {
          const type = i < requiredStandbyDrivers / 2 ? 'standby_morning' : 'standby_afternoon';
          let st = new Date(earliestMainTime.getTime());
          if (type === 'standby_afternoon') {
              st = new Date(st.getTime() + 9 * 60 * 60 * 1000); // 9 hours after morning
          }
          assignmentsToMake.push({
              type: type,
              group_id: null,
              bus_id: null,
              start_time: st
          });
      }

      // Sort assignments by start_time ASC so drivers progress from Early -> Late over their streak
      assignmentsToMake.sort((a, b) => {
         const timeA = a.start_time ? a.start_time.getTime() : Infinity;
         const timeB = b.start_time ? b.start_time.getTime() : Infinity;
         return timeA - timeB;
      });

      if (plan.operation_date === '2026-07-04' || new Date(plan.operation_date).toISOString().startsWith('2026-07-04')) {
         console.log('--- DEBUG 2026-07-04 ---');
         console.log('assignmentsToMake:', assignmentsToMake.map(a => `${a.type} ${a.start_time.toISOString()}`));
      }



      for (let i = 0; i < assignmentsToMake.length; i++) {
          const driver_id = workingDrivers[i];
          const assignment = assignmentsToMake[i];
          
          await client.query(
             `INSERT INTO assignments (plan_id, group_id, bus_id, driver_id, assignment_type, assigned_by, status)
              VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
             [plan.plan_id, assignment.group_id, assignment.bus_id, driver_id, assignment.type, dispatcherId]
          );

          if (assignment.group_id) {
             await client.query(
               `UPDATE trip_groups SET status = 'assigned' WHERE group_id = $1`,
               [assignment.group_id]
             );
          }
      }

      await client.query('COMMIT');
      return success(res, null, 'Phân công tự động thành công (Thuật toán Công Bằng & Dự bị)!');
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
};

module.exports = assignmentController;