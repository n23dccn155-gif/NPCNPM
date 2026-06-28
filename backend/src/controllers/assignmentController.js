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
    WHERE a.driver_id = $1 AND a.status = 'active' AND tg.group_id != $2 AND a.assignment_type != 'standby_morning' AND a.assignment_type != 'standby_afternoon'
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

      const groupRes = await pool.query(
        "SELECT g.*, p.operation_date, p.route_code FROM trip_groups g JOIN operation_plans p ON g.plan_id = p.plan_id WHERE g.group_id = $1",
        [groupId]
      );
      if (!groupRes.rows.length) {
        return error(res, 'Không tìm thấy nhóm chuyến', 404);
      }
      const group = groupRes.rows[0];

      const { is_replacement } = req.query;
      const isReplacement = is_replacement === 'true';

      let busQuery = "SELECT b.bus_id, b.license_plate, b.seat_count, rb.bus_role FROM buses b JOIN route_buses rb ON b.bus_id = rb.bus_id WHERE rb.route_code = $1 AND b.status = 'active'";
      if (!isReplacement) {
        busQuery += " AND rb.bus_role = 'operating' ORDER BY b.license_plate";
      } else {
        busQuery += " ORDER BY rb.bus_role DESC, b.license_plate"; 
      }

      const busesRes = await pool.query(busQuery, [group.route_code]);

      const d = new Date(group.start_time);
      const groupDateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

      const availableBuses = [];
      for (let bus of busesRes.rows) {
        const overlap = await pool.query(
          "SELECT tg.group_name FROM assignments a JOIN trip_groups tg ON a.group_id = tg.group_id WHERE a.bus_id = $1 AND a.status = 'active' AND DATE(tg.start_time) = $2 AND tg.group_id != $3",
          [bus.bus_id, groupDateStr, groupId]
        );
        if (overlap.rows.length === 0) {
          availableBuses.push(bus);
        }
      }

      const driversRes = await pool.query(
        "SELECT d.driver_id, d.full_name, d.phone, d.license_class FROM drivers d JOIN route_drivers rd ON d.driver_id = rd.driver_id WHERE rd.route_code = $1 AND rd.status = 'active' AND d.status = 'working' AND NOT EXISTS (SELECT 1 FROM leave_requests l WHERE l.driver_id = d.driver_id AND l.leave_date = $2 AND l.status = 'approved') ORDER BY d.full_name",
        [group.route_code, groupDateStr]
      );

      const availableDrivers = [];
      for (let driver of driversRes.rows) {
        const overlap = await pool.query(
          "SELECT tg.group_name FROM assignments a JOIN trip_groups tg ON a.group_id = tg.group_id WHERE a.driver_id = $1 AND a.status = 'active' AND DATE(tg.start_time) = $2 AND tg.group_id != $3",
          [driver.driver_id, groupDateStr, groupId]
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
      const dispatcherId = req.user.id;

      // 1. Lấy thông tin kế hoạch vận doanh
      const planRes = await client.query('SELECT * FROM operation_plans WHERE plan_id = $1', [planId]);
      if (!planRes.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Không tìm thấy kế hoạch', 404);
      }
      const plan = planRes.rows[0];

      // 2. Xóa các phân công cũ và reset trạng thái nhóm chuyến để thực hiện phân công mới (Đảm bảo tính Idempotent)
      await client.query('DELETE FROM assignments WHERE plan_id = $1', [planId]);
      await client.query("DELETE FROM trip_groups WHERE plan_id = $1 AND status = 'standby'", [planId]);
      await client.query("UPDATE trip_groups SET status = 'unassigned' WHERE plan_id = $1", [planId]);

      // 3. Lấy toàn bộ nhóm chuyến vận doanh (operating) chưa được phân công
      const groupsRes = await client.query(
        "SELECT * FROM trip_groups WHERE plan_id = $1 AND status = 'unassigned' ORDER BY start_time, group_id",
        [planId]
      );
      if (!groupsRes.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Không có nhóm chuyến nào cần phân công (hoặc đã phân công hết)', 400);
      }
      const groups = groupsRes.rows;

      // 4. Lấy cấu hình tuyến đường
      const routeRes = await client.query('SELECT * FROM routes WHERE route_code = $1', [plan.route_code]);
      const route = routeRes.rows[0];

      // 5. Lấy danh sách tài xế làm việc thuộc tuyến
      const routeDriversRes = await client.query(
        `SELECT rd.driver_id, d.full_name
         FROM route_drivers rd
         JOIN drivers d ON rd.driver_id = d.driver_id
         WHERE rd.route_code = $1 AND rd.status = 'active' AND d.status = 'working'
         ORDER BY rd.driver_id`,
        [plan.route_code]
      );
      const allDrivers = routeDriversRes.rows;
      if (allDrivers.length === 0) {
         await client.query('ROLLBACK');
         return error(res, 'Tuyến chưa có tài xế nào hoạt động, không thể phân công', 400);
      }

      // 6. Tạo danh sách 7 ngày trong tuần dựa trên ngày bắt đầu kế hoạch
      const daysList = [];
      const baseDate = plan.operation_date;
      const startLocalDate = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate()
      );
      for (let d = 0; d < 7; d++) {
        const cur = new Date(startLocalDate);
        cur.setDate(startLocalDate.getDate() + d);
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const date = String(cur.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${date}`;
        daysList.push(dateStr);
      }

      // Nhóm các ca chạy theo từng ngày
      const groupsByDay = {};
      for (const g of groups) {
        const d = new Date(g.start_time);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dt = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${dt}`;
        if (!groupsByDay[dateStr]) groupsByDay[dateStr] = [];
        groupsByDay[dateStr].push(g);
      }

      // 7. Kiểm tra tổng số lượng tài xế tối thiểu cần thiết để xoay vòng ca (đảm bảo nghỉ ít nhất 1 ngày/tuần)
      let maxDailyShifts = 0;
      daysList.forEach(dateStr => {
        const shiftsToday = groupsByDay[dateStr] || [];
        if (shiftsToday.length > maxDailyShifts) {
          maxDailyShifts = shiftsToday.length;
        }
      });

      const minWeeklyDrivers = Math.max(maxDailyShifts, Math.ceil(groups.length / 6));
      if (allDrivers.length < minWeeklyDrivers) {
         await client.query('ROLLBACK');
         return error(res, `Tuyến không đủ tài xế để xoay vòng ca (đảm bảo nghỉ ít nhất 1 ngày/tuần). Yêu cầu tối thiểu ${minWeeklyDrivers} tài xế, nhưng tuyến chỉ có ${allDrivers.length}.`, 400);
      }

      // 8. Lấy danh sách xe hoạt động của tuyến và ánh xạ vào các slot xe (ví dụ: "Xe 1")
      const busesRes = await client.query(
        `SELECT rb.bus_id, b.license_plate, rb.bus_role
         FROM route_buses rb
         JOIN buses b ON rb.bus_id = b.bus_id
         WHERE rb.route_code = $1 AND b.status = 'active'
         ORDER BY rb.bus_role DESC, b.license_plate`,
        [plan.route_code]
      );
      const operatingBuses = busesRes.rows.filter(b => b.bus_role === 'operating');
      const standbyBuses = busesRes.rows.filter(b => b.bus_role === 'standby');

      const busMapping = {};
      const slotNames = new Set();
      groups.forEach(g => {
        const baseName = g.group_name.split(' - ')[0];
        slotNames.add(baseName);
      });
      const sortedSlotNames = Array.from(slotNames).sort();

      if (operatingBuses.length < sortedSlotNames.length) {
         await client.query('ROLLBACK');
         return error(res, `Tuyến thiếu xe vận doanh. Yêu cầu tối thiểu ${sortedSlotNames.length} xe, hiện chỉ có ${operatingBuses.length} xe hoạt động.`, 400);
      }

      for (let i = 0; i < sortedSlotNames.length; i++) {
        busMapping[sortedSlotNames[i]] = operatingBuses[i].bus_id;
      }

      // 9. Thực hiện xoay vòng ca chạy và gán dự phòng hàng ngày
      for (let day = 0; day < 7; day++) {
        const dateStr = daysList[day];
        const shiftsToday = groupsByDay[dateStr] || [];
        // Sắp xếp ca chạy theo giờ xuất bến sớm trước muộn sau
        shiftsToday.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        // Lấy danh sách tài xế đã được duyệt nghỉ phép vào ngày này
        const leaveRes = await client.query(
          "SELECT driver_id FROM leave_requests WHERE leave_date = $1 AND status = 'approved'",
          [dateStr]
        );
        const onLeaveIds = leaveRes.rows.map(r => r.driver_id);
        const driversAvailableToday = allDrivers.filter(d => !onLeaveIds.includes(d.driver_id));

        if (driversAvailableToday.length < shiftsToday.length) {
           await client.query('ROLLBACK');
           return error(res, `Ngày ${dateStr} không đủ tài xế đi làm để vận hành. Ca chạy yêu cầu: ${shiftsToday.length}, tài xế đi làm: ${driversAvailableToday.length}`, 400);
        }

        const M = driversAvailableToday.length;
        const S = shiftsToday.length;
        // Mỗi ngày, bắt đầu lấy tài xế từ vị trí dịch chuyển tiếp theo (xoay vòng)
        const startIndex = day % M;

        const workingDrivers = [];
        const standbyDrivers = [];

        for (let i = 0; i < S; i++) {
          const idx = (startIndex + i) % M;
          workingDrivers.push(driversAvailableToday[idx]);
        }

        const workingDriverIds = workingDrivers.map(d => d.driver_id);
        for (const d of driversAvailableToday) {
          if (!workingDriverIds.includes(d.driver_id)) {
            standbyDrivers.push(d);
          }
        }

        // 9a. Gán tài xế chính thức và xe vận doanh cho các ca chạy chính
        for (let i = 0; i < S; i++) {
          const shift = shiftsToday[i];
          const baseName = shift.group_name.split(' - ')[0];
          const busId = busMapping[baseName];
          const driverId = workingDrivers[i].driver_id;

          await client.query(
            `INSERT INTO assignments (plan_id, group_id, bus_id, driver_id, assignment_type, assigned_by, status)
             VALUES ($1, $2, $3, $4, 'main', $5, 'active')`,
            [plan.plan_id, shift.group_id, busId, driverId, dispatcherId]
          );

          await client.query(
            `UPDATE trip_groups SET status = 'assigned' WHERE group_id = $1`,
            [shift.group_id]
          );
        }

        // 9b. Gán tài xế dự phòng và xe dự phòng (nếu có)
        if (standbyDrivers.length > 0) {
          const formatTimeStr = (tStr) => {
            if (!tStr) return '05:00:00';
            const parts = tStr.split(':');
            const hh = String(parts[0]).padStart(2, '0');
            const mm = String(parts[1] || '00').padStart(2, '0');
            const ss = String(parts[2] || '00').padStart(2, '0');
            return `${hh}:${mm}:${ss}`;
          };

          const sbStart = `${dateStr}T${formatTimeStr(route.start_time)}`;
          const sbEnd = `${dateStr}T${formatTimeStr(route.end_time)}`;

          for (let j = 0; j < standbyDrivers.length; j++) {
            const driverId = standbyDrivers[j].driver_id;
            const driverName = standbyDrivers[j].full_name || 'Tài xế';
            const type = j < standbyDrivers.length / 2 ? 'standby_morning' : 'standby_afternoon';
            const standbyBusId = standbyBuses[j % standbyBuses.length]?.bus_id || null;

            // Tạo riêng biệt một nhóm chuyến dự phòng cho mỗi tài xế dự bị để tránh trùng lặp uq_group_active_assignment
            const sbRes = await client.query(
              `INSERT INTO trip_groups (plan_id, group_name, start_time, end_time, status)
               VALUES ($1, $2, $3, $4, 'standby') RETURNING group_id`,
              [plan.plan_id, `Dự phòng (Nghỉ) - ${driverName}`, sbStart, sbEnd]
            );
            const sbGroupId = sbRes.rows[0].group_id;

            await client.query(
              `INSERT INTO assignments (plan_id, group_id, bus_id, driver_id, assignment_type, assigned_by, status)
               VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
              [plan.plan_id, sbGroupId, standbyBusId, driverId, type, dispatcherId]
            );
          }
        }
      }

      await client.query('COMMIT');
      return success(res, null, 'Phân công tự động thành công (Thuật toán xoay vòng và dự bị công bằng)!');
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  autoReallocateBuses: async (routeCode, brokenBusId, currentTime = new Date(), skipToday = false) => {
      const client = await pool.connect();
      try {
          await client.query('BEGIN');
          const todayStr = new Date(currentTime.getTime() - currentTime.getTimezoneOffset() * 60000).toISOString().split('T')[0];
          
          let dateCondition = "operation_date >= $2";
          if (skipToday) {
              dateCondition = "operation_date > $2"; // Only tomorrow and onwards
          }

          // 1. Find all plans for the route from the relevant date onwards
          const plansRes = await client.query(
              `SELECT plan_id, operation_date FROM operation_plans 
               WHERE route_code = $1 AND ${dateCondition} AND status = 'approved'
               ORDER BY operation_date ASC`,
              [routeCode, todayStr]
          );

          if (plansRes.rows.length === 0) {
              await client.query('ROLLBACK');
              return;
          }

          const minRestTimeRes = await client.query(`SELECT min_rest_time_minutes FROM routes WHERE route_code = $1`, [routeCode]);
          const minRestTime = minRestTimeRes.rows[0]?.min_rest_time_minutes || 15;

          // Active pool
          const busesRes = await client.query(
              `SELECT b.bus_id FROM buses b 
               JOIN route_buses rb ON b.bus_id = rb.bus_id
               WHERE rb.route_code = $1 AND b.status = 'active' AND b.bus_id != $2`,
              [routeCode, brokenBusId]
          );
          const activeBuses = busesRes.rows.map(b => b.bus_id);

          for (const plan of plansRes.rows) {
              const planDate = new Date(plan.operation_date);
              const planDateStr = new Date(planDate.getTime() - planDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
              const isToday = planDateStr === todayStr;
              console.log(`[autoReallocate] plan_id=${plan.plan_id}, planDateStr=${planDateStr}, todayStr=${todayStr}, isToday=${isToday}`);

              // Fetch all main assignments for the plan
              const assignRes = await client.query(
                  `SELECT a.assignment_id, a.group_id, a.bus_id, tg.start_time, tg.end_time 
                   FROM assignments a
                   JOIN trip_groups tg ON a.group_id = tg.group_id
                   WHERE a.plan_id = $1 AND a.assignment_type = 'main' AND a.status = 'active'
                   ORDER BY tg.start_time ASC`,
                  [plan.plan_id]
              );

              if (assignRes.rows.length === 0) continue;

              const assignments = assignRes.rows;

              if (isToday) {
                  // PHASE 1: Cascade Reallocation for Today
                  const runningAssignments = [];
                  const unstartedAssignments = [];

                  for (const a of assignments) {
                      if (a.bus_id === null) {
                          unstartedAssignments.push(a);
                      } else if (new Date(a.start_time) <= currentTime) {
                          runningAssignments.push(a);
                      } else {
                          unstartedAssignments.push(a);
                      }
                  }

                  const busState = {};
                  for (const b of activeBuses) {
                      busState[b] = { bus_id: b, availableTime: 0, shiftCount: 0 };
                  }

                  // Initialize busState with running assignments
                  for (const a of runningAssignments) {
                      if (a.bus_id === brokenBusId) continue; // broken bus is ignored in pool
                      if (!busState[a.bus_id]) {
                          busState[a.bus_id] = { bus_id: a.bus_id, availableTime: 0, shiftCount: 0 };
                      }
                      const endMin = new Date(a.end_time).getHours() * 60 + new Date(a.end_time).getMinutes();
                      busState[a.bus_id].availableTime = Math.max(busState[a.bus_id].availableTime, endMin + minRestTime);
                      busState[a.bus_id].shiftCount += 1;
                  }

                  // Reallocate for unstarted assignments
                  const busStateArr = Object.values(busState);
                  for (const a of unstartedAssignments) {
                      const startMin = new Date(a.start_time).getHours() * 60 + new Date(a.start_time).getMinutes();
                      const endMin = new Date(a.end_time).getHours() * 60 + new Date(a.end_time).getMinutes();

                      let candidateBuses = busStateArr.filter(b => b.availableTime <= startMin);
                      if (candidateBuses.length === 0) candidateBuses = busStateArr;

                      candidateBuses.sort((b1, b2) => {
                          if (b1.availableTime !== b2.availableTime) return b1.availableTime - b2.availableTime;
                          return b1.shiftCount - b2.shiftCount;
                      });

                      const selectedBus = candidateBuses[0];
                      if (a.bus_id !== selectedBus.bus_id) {
                          await client.query(
                              `UPDATE assignments SET bus_id = $1 WHERE assignment_id = $2`,
                              [selectedBus.bus_id, a.assignment_id]
                          );
                      }
                      selectedBus.shiftCount += 1;
                      selectedBus.availableTime = Math.max(selectedBus.availableTime, endMin + minRestTime);
                  }

              } else {
                  // PHASE 2: Tomorrow onwards (Simple Patching)
                  const busState = {};
                  for (const b of activeBuses) {
                      busState[b] = { bus_id: b, availableTime: 0, shiftCount: 0 };
                  }
                  const busStateArr = Object.values(busState);

                  for (const a of assignments) {
                      const startMin = new Date(a.start_time).getHours() * 60 + new Date(a.start_time).getMinutes();
                      const endMin = new Date(a.end_time).getHours() * 60 + new Date(a.end_time).getMinutes();

                      let candidateBuses = busStateArr.filter(b => b.availableTime <= startMin);
                      if (candidateBuses.length === 0) candidateBuses = busStateArr;

                      candidateBuses.sort((b1, b2) => {
                          if (b1.availableTime !== b2.availableTime) return b1.availableTime - b2.availableTime;
                          return b1.shiftCount - b2.shiftCount;
                      });

                      const selectedBus = candidateBuses[0];
                      if (a.bus_id !== selectedBus.bus_id) {
                          await client.query(
                              `UPDATE assignments SET bus_id = $1 WHERE assignment_id = $2`,
                              [selectedBus.bus_id, a.assignment_id]
                          );
                      }
                      selectedBus.shiftCount += 1;
                      selectedBus.availableTime = Math.max(selectedBus.availableTime, endMin + minRestTime);
                  }
              }
          }
          await client.query('COMMIT');
          console.log(`Auto-reallocation completed for broken bus ${brokenBusId} on route ${routeCode}`);
      } catch (err) {
          await client.query('ROLLBACK');
          console.error("Auto-reallocation failed:", err);
      } finally {
          client.release();
      }
  }
};

module.exports = assignmentController;