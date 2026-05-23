// assignmentController.js - Xử lý phân công chuyến xe (nghiệp vụ trung tâm)
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return h * 60 + m;
}

// Kiểm tra các điều kiện phân công
async function checkAssignmentConditions(trip_code, bus_id, driver_code, excluded_assignment_id = null) {
  const issues = [];

  // 1. Lấy thông tin chuyến
  const tripRes = await pool.query('SELECT * FROM trips WHERE trip_code = $1', [trip_code]);
  if (!tripRes.rows.length) return { valid: false, issues: ['Chuyến xe không tồn tại'] };
  const trip = tripRes.rows[0];

  // 2. Kiểm tra trạng thái xe
  const busRes = await pool.query('SELECT * FROM buses WHERE bus_id = $1', [bus_id]);
  if (!busRes.rows.length) return { valid: false, issues: ['Xe không tồn tại'] };
  const bus = busRes.rows[0];
  if (bus.status === 'broken') issues.push('Xe đang hỏng, không thể phân công');
  if (bus.status === 'inactive') issues.push('Xe đã ngưng sử dụng, không thể phân công');

  // 3. Kiểm tra trạng thái tài xế
  const driverRes = await pool.query('SELECT * FROM drivers WHERE driver_code = $1', [driver_code]);
  if (!driverRes.rows.length) return { valid: false, issues: ['Tài xế không tồn tại'] };
  const driver = driverRes.rows[0];
  if (driver.status === 'inactive') issues.push('Tài xế đã ngưng làm việc, không thể phân công');
  if (driver.status === 'suspended') issues.push('Tài xế đang tạm nghỉ, không thể phân công');

  // 4. Kiểm tra yêu cầu nghỉ đã duyệt của tài xế trùng ngày/ca của chuyến
  // Xác định ca (shift) của chuyến dựa trên giờ xuất bến dự kiến
  const tripHour = parseInt(trip.scheduled_departure.split(':')[0], 10);
  const tripShift = tripHour < 12 ? 'morning' : 'afternoon';

  const leaveRes = await pool.query(
    `SELECT * FROM leave_requests 
     WHERE driver_code = $1 AND leave_date = $2 AND status = 'approved'
       AND (shift_type = 'full_day' OR shift_type = $3)`,
    [driver_code, trip.trip_date, tripShift]
  );
  if (leaveRes.rows.length) {
    issues.push(`Tài xế có yêu cầu nghỉ đã được duyệt (${leaveRes.rows[0].shift_type === 'full_day' ? 'Cả ngày' : (leaveRes.rows[0].shift_type === 'morning' ? 'Ca sáng' : 'Ca chiều')}) vào ngày ${trip.trip_date.toISOString().split('T')[0]}`);
  }

  // 5. Kiểm tra trùng lịch xe (A.departure < B.arrival AND B.departure < A.arrival)
  let busConflictQuery = `
    SELECT t.trip_code, t.scheduled_departure, t.scheduled_arrival 
    FROM trip_assignments ta
    JOIN trips t ON ta.trip_code = t.trip_code
    WHERE ta.bus_id = $1 AND ta.status = 'active' AND t.trip_date = $2 AND t.trip_code != $3
  `;
  const busConflictParams = [bus_id, trip.trip_date, trip_code];
  if (excluded_assignment_id) {
    busConflictQuery += ` AND ta.id != $4`;
    busConflictParams.push(excluded_assignment_id);
  }
  const busConflict = await pool.query(busConflictQuery, busConflictParams);
  
  const tripStart = timeToMinutes(trip.scheduled_departure);
  const tripEnd = timeToMinutes(trip.scheduled_arrival);

  for (const otherTrip of busConflict.rows) {
    const otherStart = timeToMinutes(otherTrip.scheduled_departure);
    const otherEnd = timeToMinutes(otherTrip.scheduled_arrival);
    if (tripStart < otherEnd && otherStart < tripEnd) {
      issues.push(`Xe bị trùng lịch với chuyến ${otherTrip.trip_code} (${otherTrip.scheduled_departure.substring(0,5)} - ${otherTrip.scheduled_arrival.substring(0,5)})`);
    }
  }

  // 6. Kiểm tra trùng lịch tài xế
  let driverConflictQuery = `
    SELECT t.trip_code, t.scheduled_departure, t.scheduled_arrival 
    FROM trip_assignments ta
    JOIN trips t ON ta.trip_code = t.trip_code
    WHERE ta.driver_code = $1 AND ta.status = 'active' AND t.trip_date = $2 AND t.trip_code != $3
  `;
  const driverConflictParams = [driver_code, trip.trip_date, trip_code];
  if (excluded_assignment_id) {
    driverConflictQuery += ` AND ta.id != $4`;
    driverConflictParams.push(excluded_assignment_id);
  }
  const driverConflict = await pool.query(driverConflictQuery, driverConflictParams);

  for (const otherTrip of driverConflict.rows) {
    const otherStart = timeToMinutes(otherTrip.scheduled_departure);
    const otherEnd = timeToMinutes(otherTrip.scheduled_arrival);
    if (tripStart < otherEnd && otherStart < tripEnd) {
      issues.push(`Tài xế bị trùng lịch với chuyến ${otherTrip.trip_code} (${otherTrip.scheduled_departure.substring(0,5)} - ${otherTrip.scheduled_arrival.substring(0,5)})`);
    }
  }

  // 7. Kiểm tra thời gian lái liên tục
  // Lấy các cấu hình
  const configRes = await pool.query(`SELECT config_key, config_value FROM configurations`);
  let minBreakTime = 15;
  let maxContinuousDriving = 240;
  for (const row of configRes.rows) {
    if (row.config_key === 'min_break_time_minutes') {
      minBreakTime = parseInt(row.config_value, 10);
    } else if (row.config_key === 'max_continuous_driving_minutes') {
      maxContinuousDriving = parseInt(row.config_value, 10);
    }
  }

  // Lấy tất cả các chuyến xe khác của tài xế này trong cùng ngày
  let driverTripsQuery = `
    SELECT t.trip_code, t.scheduled_departure, t.scheduled_arrival 
    FROM trip_assignments ta
    JOIN trips t ON ta.trip_code = t.trip_code
    WHERE ta.driver_code = $1 AND ta.status = 'active' AND t.trip_date = $2 AND t.trip_code != $3
  `;
  const driverTripsParams = [driver_code, trip.trip_date, trip_code];
  if (excluded_assignment_id) {
    driverTripsQuery += ` AND ta.id != $4`;
    driverTripsParams.push(excluded_assignment_id);
  }
  const driverTripsRes = await pool.query(driverTripsQuery, driverTripsParams);

  // Tạo danh sách chuyến gồm chuyến hiện tại và các chuyến đã phân công
  const driverAllTrips = [...driverTripsRes.rows, {
    trip_code: trip.trip_code,
    scheduled_departure: trip.scheduled_departure,
    scheduled_arrival: trip.scheduled_arrival
  }];

  // Sắp xếp các chuyến theo giờ xuất phát
  driverAllTrips.sort((a, b) => timeToMinutes(a.scheduled_departure) - timeToMinutes(b.scheduled_departure));

  // Gom các chuyến thành chuỗi lái xe liên tục
  const blocks = [];
  let currentBlock = null;

  for (const t of driverAllTrips) {
    const start = timeToMinutes(t.scheduled_departure);
    const end = timeToMinutes(t.scheduled_arrival);

    if (!currentBlock) {
      currentBlock = { start, end, trips: [t.trip_code] };
    } else {
      const restTime = start - currentBlock.end;
      if (restTime < minBreakTime) {
        // Thuộc cùng chuỗi lái liên tục
        currentBlock.end = Math.max(currentBlock.end, end);
        currentBlock.trips.push(t.trip_code);
      } else {
        // Bắt đầu chuỗi mới
        blocks.push(currentBlock);
        currentBlock = { start, end, trips: [t.trip_code] };
      }
    }
  }
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // Kiểm tra xem có chuỗi nào vượt quá max_continuous_driving_minutes không
  for (const block of blocks) {
    const duration = block.end - block.start;
    if (duration > maxContinuousDriving) {
      issues.push(`Tài xế lái liên tục quá thời gian cho phép (${duration} phút, tối đa ${maxContinuousDriving} phút) trên chuỗi chuyến: ${block.trips.join(' -> ')}`);
    }
  }

  return { valid: issues.length === 0, issues, trip };
}

const assignmentController = {
  // Xem lịch phân công tổng quan
  getSchedule: async (req, res, next) => {
    try {
      const { trip_date, route_code } = req.query;
      let query = `
        SELECT t.trip_code, t.trip_date, t.scheduled_departure, t.scheduled_arrival, t.route_code, r.route_name,
          t.direction, ta.id AS assignment_id, ta.bus_id, ta.driver_code, d.full_name AS driver_name,
          ta.status AS assignment_status, t.status AS trip_status
        FROM trips t
        JOIN routes r ON t.route_code = r.route_code
        LEFT JOIN trip_assignments ta ON t.trip_code = ta.trip_code AND ta.status = 'active'
        LEFT JOIN drivers d ON ta.driver_code = d.driver_code
        WHERE 1=1
      `;
      const params = [];
      if (trip_date) { params.push(trip_date); query += ` AND t.trip_date = $${params.length}`; }
      if (route_code) { params.push(route_code); query += ` AND t.route_code = $${params.length}`; }
      query += ' ORDER BY t.trip_date, t.scheduled_departure';
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Tài xế xem lịch chuyến được phân công cho mình
  getMySchedule: async (req, res, next) => {
    try {
      const driverRes = await pool.query(
        'SELECT driver_code FROM drivers WHERE user_id = $1', [req.user.id]
      );
      if (!driverRes.rows.length) return error(res, 'Không tìm thấy hồ sơ tài xế', 404);
      const driver_code = driverRes.rows[0].driver_code;
      const { trip_date_from, trip_date_to, trip_date } = req.query;
      let query = `
        SELECT t.trip_code, t.trip_date, t.scheduled_departure, t.scheduled_arrival, t.route_code, r.route_name,
          t.direction, ta.id AS assignment_id, ta.bus_id, ta.driver_code, ta.status AS assignment_status,
          t.status AS trip_status
        FROM trip_assignments ta
        JOIN trips t ON ta.trip_code = t.trip_code
        JOIN routes r ON t.route_code = r.route_code
        WHERE ta.driver_code = $1 AND ta.status = 'active'
      `;
      const params = [driver_code];
      if (trip_date) { params.push(trip_date); query += ` AND t.trip_date = $${params.length}`; }
      if (trip_date_from) { params.push(trip_date_from); query += ` AND t.trip_date >= $${params.length}`; }
      if (trip_date_to) { params.push(trip_date_to); query += ` AND t.trip_date <= $${params.length}`; }
      query += ' ORDER BY t.trip_date, t.scheduled_departure';
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Kiểm tra điều kiện phân công (không lưu)
  check: async (req, res, next) => {
    try {
      const { trip_code, bus_id, driver_code, excluded_assignment_id } = req.body;
      if (!trip_code || !bus_id || !driver_code) return error(res, 'Thiếu thông tin kiểm tra', 400);
      const result = await checkAssignmentConditions(trip_code, bus_id, driver_code, excluded_assignment_id);
      return success(res, result, result.valid ? 'Phân công hợp lệ' : 'Phân công có vấn đề');
    } catch (err) { next(err); }
  },

  // Lập phiếu phân công mới
  create: async (req, res, next) => {
    try {
      const { trip_code, bus_id, driver_code } = req.body;
      const dispatcher_id = req.user.id;

      // Kiểm tra chuyến đã có phân công active chưa
      const existing = await pool.query(
        `SELECT id FROM trip_assignments WHERE trip_code = $1 AND status = 'active'`, [trip_code]
      );
      if (existing.rows.length)
        return error(res, 'Chuyến này đã có phiếu phân công. Hãy sử dụng chức năng Điều chỉnh phân công.', 409);

      // Kiểm tra điều kiện
      const check = await checkAssignmentConditions(trip_code, bus_id, driver_code);
      if (!check.valid) return res.status(400).json({ success: false, message: 'Không thể phân công', issues: check.issues });

      const result = await pool.query(
        `INSERT INTO trip_assignments (trip_code, bus_id, driver_code, dispatcher_id, status)
         VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
        [trip_code, bus_id, driver_code, dispatcher_id]
      );

      // Cập nhật trạng thái chuyến thành 'assigned'
      await pool.query('UPDATE trips SET status = \'assigned\' WHERE trip_code = $1', [trip_code]);

      return success(res, result.rows[0], 'Lập phiếu phân công thành công', 201);
    } catch (err) { next(err); }
  },

  // Điều chỉnh phân công (đổi xe/tài xế)
  replace: async (req, res, next) => {
    try {
      const { tripCode } = req.params;
      const { bus_id, driver_code } = req.body;
      const dispatcher_id = req.user.id;

      // Lấy phiếu phân công active hiện tại
      const currentActive = await pool.query(
        `SELECT id FROM trip_assignments WHERE trip_code = $1 AND status = 'active'`, [tripCode]
      );
      
      const excluded_id = currentActive.rows.length ? currentActive.rows[0].id : null;

      // Kiểm tra điều kiện
      const check = await checkAssignmentConditions(tripCode, bus_id, driver_code, excluded_id);
      if (!check.valid) return res.status(400).json({ success: false, message: 'Không thể điều chỉnh phân công', issues: check.issues });

      // Chuyển phiếu cũ sang 'replaced'
      await pool.query(
        `UPDATE trip_assignments SET status = 'replaced' WHERE trip_code = $1 AND status = 'active'`, [tripCode]
      );

      // Tạo phiếu mới active
      const result = await pool.query(
        `INSERT INTO trip_assignments (trip_code, bus_id, driver_code, dispatcher_id, status)
         VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
        [tripCode, bus_id, driver_code, dispatcher_id]
      );

      // Cập nhật trạng thái chuyến thành 'assigned'
      await pool.query('UPDATE trips SET status = \'assigned\' WHERE trip_code = $1', [tripCode]);

      return success(res, result.rows[0], 'Điều chỉnh phân công thành công');
    } catch (err) { next(err); }
  },

  // Xem lịch sử phân công của một chuyến
  getHistory: async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT ta.*, d.full_name AS driver_name, u.username AS dispatcher_username
         FROM trip_assignments ta
         LEFT JOIN drivers d ON ta.driver_code = d.driver_code
         LEFT JOIN users u ON ta.dispatcher_id = u.id
         WHERE ta.trip_code = $1
         ORDER BY ta.assigned_at DESC`,
        [req.params.tripCode]
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },
};
module.exports = assignmentController;
