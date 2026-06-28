// leaveRequestController.js: Quản lý yêu cầu nghỉ phép của tài xế theo thiết kế mới
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const leaveRequestController = {
  // Tài xế xem danh sách đơn xin nghỉ của mình
  getMy: async (req, res, next) => {
    try {
      const driverRes = await pool.query('SELECT driver_id FROM drivers WHERE user_id = $1', [req.user.id]);
      if (!driverRes.rows.length) {
        return error(res, 'Không tìm thấy hồ sơ tài xế', 404);
      }
      const driverId = driverRes.rows[0].driver_id;

      const result = await pool.query(
        'SELECT * FROM leave_requests WHERE driver_id = $1 ORDER BY leave_id DESC',
        [driverId]
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Tài xế gửi yêu cầu nghỉ
  create: async (req, res, next) => {
    try {
      const driverRes = await pool.query('SELECT driver_id FROM drivers WHERE user_id = $1', [req.user.id]);
      if (!driverRes.rows.length) {
        return error(res, 'Không tìm thấy hồ sơ tài xế', 404);
      }
      const driverId = driverRes.rows[0].driver_id;
      const { leave_date, reason } = req.body;

      if (!leave_date) {
        return error(res, 'Vui lòng cung cấp ngày muốn nghỉ phép', 400);
      }

      const today = new Date();
      const reqDate = new Date(leave_date);
      const diffTime = reqDate.setHours(0,0,0,0) - today.setHours(0,0,0,0);
      if (diffTime <= 0) {
        return error(res, 'Phải gửi đơn xin nghỉ trước ít nhất 1 ngày', 400);
      }

      // Kiểm tra đơn nghỉ phép bị trùng ngày đã gửi trước đó
      const existingRes = await pool.query(
        "SELECT leave_id FROM leave_requests WHERE driver_id = $1 AND leave_date = $2 AND status != 'rejected'",
        [driverId, leave_date]
      );
      if (existingRes.rows.length > 0) {
        return error(res, 'Bạn đã gửi yêu cầu nghỉ phép cho ngày này rồi', 400);
      }

      const result = await pool.query(
        `INSERT INTO leave_requests (driver_id, leave_date, reason, status) 
         VALUES ($1, $2, $3, 'pending') RETURNING *`,
        [driverId, leave_date, reason || null]
      );

      // Gửi thông báo cho các quản lý vận hành
      const managers = await pool.query("SELECT user_id FROM users WHERE role = 'manager' AND status = 'active'");
      const driverInfo = await pool.query("SELECT full_name FROM drivers WHERE driver_id = $1", [driverId]);
      const driverName = driverInfo.rows[0].full_name;
      
      for (let mgr of managers.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, content) 
           VALUES ($1, 'Yêu cầu nghỉ phép mới', $2)`,
          [mgr.user_id, `Tài xế ${driverName} xin nghỉ phép ngày ${leave_date}.`]
        );
      }

      return success(res, result.rows[0], 'Gửi yêu cầu nghỉ phép thành công', 201);
    } catch (err) { next(err); }
  },

  // Quản lý xem tất cả yêu cầu nghỉ phép
  getAll: async (req, res, next) => {
    try {
      const { status } = req.query;
      let query = `
        SELECT lr.*, d.full_name AS driver_name, u.full_name as reviewer_name
        FROM leave_requests lr
        JOIN drivers d ON lr.driver_id = d.driver_id
        LEFT JOIN users u ON lr.reviewed_by = u.user_id
      `;
      const params = [];
      if (status) {
        params.push(status);
        query += ` WHERE lr.status = $1`;
      }
      query += ' ORDER BY lr.leave_id DESC';
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Quản lý duyệt hoặc từ chối yêu cầu nghỉ phép (XL12, XL13)
  review: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { requestId } = req.params;
      const { status } = req.body; // 'approved' hoặc 'rejected'
      const managerId = req.user.id;

      if (!['approved', 'rejected'].includes(status)) {
        await client.query('ROLLBACK');
        return error(res, 'Quyết định không hợp lệ', 400);
      }

      const leaveRes = await client.query('SELECT * FROM leave_requests WHERE leave_id = $1', [requestId]);
      if (!leaveRes.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Yêu cầu nghỉ phép không tồn tại', 404);
      }
      const leave = leaveRes.rows[0];

      if (leave.status !== 'pending') {
        await client.query('ROLLBACK');
        return error(res, 'Đơn xin nghỉ phép đã được xử lý từ trước', 400);
      }

      // Cập nhật trạng thái đơn
      const updatedRes = await client.query(
        `UPDATE leave_requests 
         SET status = $1, reviewed_by = $2 
         WHERE leave_id = $3 RETURNING *`,
        [status, managerId, requestId]
      );

      const driverInfo = await client.query("SELECT user_id, full_name FROM drivers WHERE driver_id = $1", [leave.driver_id]);
      const driverUser = driverInfo.rows[0];

      // Gửi thông báo cho tài xế gửi đơn
      await client.query(
        `INSERT INTO notifications (user_id, title, content) 
         VALUES ($1, 'Kết quả xin nghỉ phép', $2)`,
        [driverUser.user_id, `Đơn xin nghỉ phép ngày ${leave.leave_date.toISOString().split('T')[0]} của bạn đã được ${status === 'approved' ? 'chấp nhận' : 'từ chối'}.`]
      );

      // Nếu duyệt nghỉ phép, kiểm tra xem có ảnh hưởng đến các phân công chạy xe không (XL12)
      if (status === 'approved') {
        const affectedAssignments = await client.query(
          `SELECT tg.group_id, tg.group_name, p.created_by as dispatcher_id, p.route_code
           FROM assignments a
           JOIN trip_groups tg ON a.group_id = tg.group_id
           JOIN operation_plans p ON tg.plan_id = p.plan_id
           WHERE a.driver_id = $1 AND p.operation_date = $2 AND a.status = 'active'`,
          [leave.driver_id, leave.leave_date]
        );

        // Gửi thông báo cảnh báo cho Dispatcher (XL13)
        for (let assign of affectedAssignments.rows) {
          await client.query(
            `INSERT INTO notifications (user_id, title, content) 
             VALUES ($1, 'Cảnh báo phân công', $2)`,
            [assign.dispatcher_id, `Tài xế ${driverUser.full_name} xin nghỉ phép đột xuất đã được duyệt. Vui lòng thay thế tài xế cho nhóm chuyến ${assign.group_name} (Tuyến ${assign.route_code}) ngày ${leave.leave_date.toISOString().split('T')[0]}.`]
          );
        }
      }

      await client.query('COMMIT');
      return success(res, updatedRes.rows[0], `Đã ${status === 'approved' ? 'duyệt' : 'từ chối'} đơn nghỉ phép.`);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  // Xem các nhóm chuyến bị ảnh hưởng do đơn nghỉ phép
  getAffectedGroups: async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const leaveRes = await pool.query('SELECT * FROM leave_requests WHERE leave_id = $1', [requestId]);
      if (!leaveRes.rows.length) return error(res, 'Không tìm thấy yêu cầu nghỉ', 404);
      const leave = leaveRes.rows[0];

      const result = await pool.query(
        `SELECT tg.group_id, tg.group_name, tg.start_time, tg.end_time, p.route_code,
                a.bus_id, a.driver_id, b.license_plate, d.full_name as driver_name
         FROM assignments a
         JOIN trip_groups tg ON a.group_id = tg.group_id
         JOIN operation_plans p ON tg.plan_id = p.plan_id
         LEFT JOIN buses b ON a.bus_id = b.bus_id
         LEFT JOIN drivers d ON a.driver_id = d.driver_id
         WHERE a.driver_id = $1 AND p.operation_date = $2 AND a.status = 'active'`,
        [leave.driver_id, leave.leave_date]
      );

      return success(res, result.rows);
    } catch (err) { next(err); }
  }
};

module.exports = leaveRequestController;
