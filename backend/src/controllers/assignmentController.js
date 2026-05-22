// assignmentController.js - Xử lý phân công chuyến xe (nghiệp vụ trung tâm)
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

// Kiểm tra các điều kiện phân công
async function checkAssignmentConditions(trip_code, bus_id, driver_code) {
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

  // 4. Kiểm tra yêu cầu nghỉ đã duyệt của tài xế trùng ngày chuyến
  const leaveRes = await pool.query(
    `SELECT * FROM leave_requests 
     WHERE driver_code = $1 AND leave_date = $2 AND status = 'approved'`,
    [driver_code, trip.trip_date]
  );
  if (leaveRes.rows.length) issues.push(`Tài xế đã có nghỉ phép được duyệt vào ngày ${trip.trip_date}`);

  // 5. Kiểm tra trùng lịch xe
  const busConflict = await pool.query(
    `SELECT t.trip_code, t.trip_date, t.scheduled_departure FROM trip_assignments ta
     JOIN trips t ON ta.trip_code = t.trip_code
     WHERE ta.bus_id = $1 AND ta.status = 'active' AND t.trip_date = $2 AND ta.trip_code != $3`,
    [bus_id, trip.trip_date, trip_code]
  );
  if (busConflict.rows.length)
    issues.push(`Xe đã được phân công cho chuyến ${busConflict.rows.map(r => r.trip_code).join(', ')} cùng ngày`);

  // 6. Kiểm tra trùng lịch tài xế
  const driverConflict = await pool.query(
    `SELECT t.trip_code, t.trip_date, t.scheduled_departure FROM trip_assignments ta
     JOIN trips t ON ta.trip_code = t.trip_code
     WHERE ta.driver_code = $1 AND ta.status = 'active' AND t.trip_date = $2 AND ta.trip_code != $3`,
    [driver_code, trip.trip_date, trip_code]
  );
  if (driverConflict.rows.length)
    issues.push(`Tài xế đã được phân công cho chuyến ${driverConflict.rows.map(r => r.trip_code).join(', ')} cùng ngày`);

  return { valid: issues.length === 0, issues, trip };
}

const assignmentController = {
  // Xem lịch phân công tổng quan
  getSchedule: async (req, res, next) => {
    try {
      const { trip_date, route_code } = req.query;
      let query = `
        SELECT t.trip_code, t.trip_date, t.scheduled_departure, t.route_code, r.route_name,
          ta.bus_id, ta.driver_code, d.full_name AS driver_name, ta.status AS assignment_status
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

  // Kiểm tra điều kiện phân công (không lưu)
  check: async (req, res, next) => {
    try {
      const { trip_code, bus_id, driver_code } = req.body;
      if (!trip_code || !bus_id || !driver_code) return error(res, 'Thiếu thông tin kiểm tra', 400);
      const result = await checkAssignmentConditions(trip_code, bus_id, driver_code);
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
      return success(res, result.rows[0], 'Lập phiếu phân công thành công', 201);
    } catch (err) { next(err); }
  },

  // Điều chỉnh phân công (đổi xe/tài xế)
  replace: async (req, res, next) => {
    try {
      const { tripCode } = req.params;
      const { bus_id, driver_code } = req.body;
      const dispatcher_id = req.user.id;

      // Kiểm tra điều kiện
      const check = await checkAssignmentConditions(tripCode, bus_id, driver_code);
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
