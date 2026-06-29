// busController.js: Quản lý danh sách xe buýt theo thiết kế mới
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const busController = {
  // Lấy danh sách xe buýt
  getAll: async (req, res, next) => {
    try {
      const { status, route_code } = req.query;
      let query = 'SELECT b.bus_id, b.license_plate, b.seat_count, b.status FROM buses b';
      const params = [];
      const conditions = [];

      if (route_code) {
        query += ' JOIN route_buses rb ON b.bus_id = rb.bus_id';
        params.push(route_code);
        conditions.push(`rb.route_code = $${params.length}`);
      }

      if (status) {
        params.push(status);
        conditions.push(`b.status = $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ' ORDER BY b.bus_id';
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Lấy chi tiết xe buýt
  getOne: async (req, res, next) => {
    try {
      const { busId } = req.params;
      const result = await pool.query('SELECT bus_id, license_plate, seat_count, status FROM buses WHERE bus_id = $1', [busId]);
      if (!result.rows.length) return error(res, 'Không tìm thấy xe buýt', 404);
      return success(res, result.rows[0]);
    } catch (err) { next(err); }
  },

  // Tạo xe buýt mới (bus_id tự tăng)
  create: async (req, res, next) => {
    try {
      const { license_plate, seat_count } = req.body;
      if (!license_plate || !seat_count) {
        return error(res, 'Thiếu thông tin biển số xe hoặc số chỗ ngồi', 400);
      }

      const seats = parseInt(seat_count, 10);
      if (isNaN(seats) || seats <= 0) {
        return error(res, 'Số chỗ ngồi phải là số nguyên dương', 400);
      }

      const result = await pool.query(
        'INSERT INTO buses (license_plate, seat_count, status) VALUES ($1, $2, \'active\') RETURNING bus_id, license_plate, seat_count, status',
        [license_plate, seats]
      );
            // Gửi thông báo cho manager và dispatcher
const content = `Xe mới ${license_plate} (số chỗ ${seats}) đã được thêm vào hệ thống.`;
const users = await pool.query("SELECT user_id FROM users WHERE role IN ('manager', 'dispatcher') AND status = 'active'");
const { broadcast } = require('../sockets/socketManager');
for (let u of users.rows) {
  await pool.query(
    `INSERT INTO notifications (user_id, title, content) VALUES ($1, 'Xe mới được thêm', $2)`,
    [u.user_id, content]
  );
}
broadcast('NEW_NOTIFICATION', { title: 'Xe mới được thêm', content });

      return success(res, result.rows[0], 'Thêm xe buýt thành công', 201);
    } catch (err) {
      if (err.code === '23505') return error(res, 'Biển số xe đã tồn tại', 409);
      next(err);
    }
  },

  // Cập nhật thông tin xe buýt
  update: async (req, res, next) => {
    try {
      const { busId } = req.params;
      const { license_plate, seat_count } = req.body;
      if (!license_plate || !seat_count) {
        return error(res, 'Thiếu thông tin biển số xe hoặc số chỗ ngồi', 400);
      }

      const seats = parseInt(seat_count, 10);
      if (isNaN(seats) || seats <= 0) {
        return error(res, 'Số chỗ ngồi phải là số nguyên dương', 400);
      }

      const result = await pool.query(
        'UPDATE buses SET license_plate = $1, seat_count = $2 WHERE bus_id = $3 RETURNING bus_id, license_plate, seat_count, status',
        [license_plate, seats, busId]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy xe buýt', 404);
      // Gửi thông báo cho manager và dispatcher
const content = `Xe mới ${license_plate} (số chỗ ${seats}) đã được thêm vào hệ thống.`;
const users = await pool.query("SELECT user_id FROM users WHERE role IN ('manager', 'dispatcher') AND status = 'active'");
const { broadcast } = require('../sockets/socketManager');
for (let u of users.rows) {
  await pool.query(
    `INSERT INTO notifications (user_id, title, content) VALUES ($1, 'Xe mới được thêm', $2)`,
    [u.user_id, content]
  );
}
broadcast('NEW_NOTIFICATION', { title: 'Xe mới được thêm', content });

      return success(res, result.rows[0], 'Cập nhật xe buýt thành công');
    } catch (err) { next(err); }
  },

  // Cập nhật trạng thái xe buýt
  updateStatus: async (req, res, next) => {
    try {
      const { busId } = req.params;
      const { status } = req.body;
      if (!['active', 'broken', 'inactive'].includes(status)) {
        return error(res, 'Trạng thái không hợp lệ', 400);
      }
      const result = await pool.query(
        'UPDATE buses SET status = $1 WHERE bus_id = $2 RETURNING bus_id, license_plate, seat_count, status',
        [status, busId]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy xe buýt', 404);
if (status === 'active') {
        const assignmentController = require('./assignmentController');
        const rbRes = await pool.query("SELECT route_code FROM route_buses WHERE bus_id = $1", [busId]);
        if (rbRes.rows.length > 0) {
           const routeCode = rbRes.rows[0].route_code;
           // Run asynchronously to calculate for tomorrow onwards (skipToday = true)
           assignmentController.autoReallocateBuses(routeCode, -1, new Date(), true).catch(e => console.error(e));
        }
      }

      // Thông báo thay đổi trạng thái xe cho Điều phối viên
      const statusLabel = { active: 'Hoạt động', broken: 'Hỏng', inactive: 'Ngừng hoạt động' };
      const content = `Xe ${result.rows[0].license_plate} đã chuyển sang trạng thái: ${statusLabel[status] || status}.`;
      const dispatchers = await pool.query("SELECT user_id FROM users WHERE role = 'dispatcher' AND status = 'active'");
      for (let disp of dispatchers.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, content) VALUES ($1, 'Cập nhật trạng thái xe', $2)`,
          [disp.user_id, content]
        );
      }
      const { broadcast } = require('../sockets/socketManager');
      broadcast('NEW_NOTIFICATION', { title: 'Cập nhật trạng thái xe', content });

      return success(res, result.rows[0], 'Cập nhật trạng thái xe buýt thành công');
    } catch (err) { next(err); }
  },
};

module.exports = busController;
