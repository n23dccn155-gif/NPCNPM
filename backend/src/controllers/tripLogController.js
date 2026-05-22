// tripLogController.js + reportController.js
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const tripLogController = {
  getAll: async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT tl.*, t.route_code, t.trip_date, t.scheduled_departure, r.route_name
         FROM trip_logs tl JOIN trips t ON tl.trip_code = t.trip_code
         JOIN routes r ON t.route_code = r.route_code
         ORDER BY t.trip_date DESC, t.scheduled_departure DESC`
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  getOne: async (req, res, next) => {
    try {
      const result = await pool.query('SELECT * FROM trip_logs WHERE trip_code = $1', [req.params.tripCode]);
      if (!result.rows.length) return error(res, 'Chưa có bản ghi thực hiện chuyến này', 404);
      return success(res, result.rows[0]);
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { trip_code, assignment_id, actual_departure, status } = req.body;
      if (!trip_code || !assignment_id) return error(res, 'Thiếu thông tin bắt buộc', 400);

      // Tính số phút trễ
      const tripRes = await pool.query('SELECT trip_date, scheduled_departure FROM trips WHERE trip_code = $1', [trip_code]);
      if (!tripRes.rows.length) return error(res, 'Chuyến xe không tồn tại', 404);
      const { trip_date, scheduled_departure } = tripRes.rows[0];

      let delay_minutes = 0;
      if (actual_departure) {
        const scheduled = new Date(`${trip_date}T${scheduled_departure}`);
        const actual = new Date(`${trip_date}T${actual_departure}`);
        const diff = Math.floor((actual - scheduled) / 60000);
        delay_minutes = diff > 0 ? diff : 0;
      }

      const result = await pool.query(
        `INSERT INTO trip_logs (trip_code, assignment_id, actual_departure, delay_minutes, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [trip_code, assignment_id, actual_departure || null, delay_minutes, status || 'completed']
      );
      return success(res, result.rows[0], 'Ghi nhận thực hiện chuyến thành công', 201);
    } catch (err) {
      if (err.code === '23505') return error(res, 'Chuyến này đã có bản ghi thực hiện', 409);
      next(err);
    }
  },
};

const reportController = {
  routeReport: async (req, res, next) => {
    try {
      const { from_date, to_date } = req.query;
      const params = [from_date || '2000-01-01', to_date || '2099-12-31'];
      const result = await pool.query(
        `SELECT r.route_code, r.route_name,
           COUNT(t.trip_code) AS total_trips,
           COUNT(tl.id) AS executed_trips,
           SUM(CASE WHEN tl.delay_minutes = 0 THEN 1 ELSE 0 END) AS on_time_trips,
           SUM(CASE WHEN tl.delay_minutes > 0 THEN 1 ELSE 0 END) AS delayed_trips,
           SUM(CASE WHEN tl.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_trips
         FROM routes r
         LEFT JOIN trips t ON r.route_code = t.route_code AND t.trip_date BETWEEN $1 AND $2
         LEFT JOIN trip_logs tl ON t.trip_code = tl.trip_code
         GROUP BY r.route_code, r.route_name ORDER BY r.route_code`,
        params
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  busReport: async (req, res, next) => {
    try {
      const { from_date, to_date } = req.query;
      const params = [from_date || '2000-01-01', to_date || '2099-12-31'];
      const result = await pool.query(
        `SELECT b.bus_id, b.license_plate, b.capacity, b.status,
           COUNT(ta.id) AS total_assignments,
           SUM(CASE WHEN tl.id IS NOT NULL THEN 1 ELSE 0 END) AS executed_trips,
           AVG(tl.delay_minutes) AS avg_delay_minutes
         FROM buses b
         LEFT JOIN trip_assignments ta ON b.bus_id = ta.bus_id AND ta.status = 'active'
         LEFT JOIN trips t ON ta.trip_code = t.trip_code AND t.trip_date BETWEEN $1 AND $2
         LEFT JOIN trip_logs tl ON t.trip_code = tl.trip_code
         GROUP BY b.bus_id, b.license_plate, b.capacity, b.status ORDER BY b.bus_id`,
        params
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  driverReport: async (req, res, next) => {
    try {
      const { from_date, to_date } = req.query;
      const params = [from_date || '2000-01-01', to_date || '2099-12-31'];
      const result = await pool.query(
        `SELECT d.driver_code, d.full_name, d.status,
           COUNT(ta.id) AS total_assignments,
           SUM(CASE WHEN tl.id IS NOT NULL THEN 1 ELSE 0 END) AS executed_trips,
           SUM(CASE WHEN tl.delay_minutes > 0 THEN 1 ELSE 0 END) AS delayed_trips,
           COUNT(lr.id) AS leave_days
         FROM drivers d
         LEFT JOIN trip_assignments ta ON d.driver_code = ta.driver_code AND ta.status = 'active'
         LEFT JOIN trips t ON ta.trip_code = t.trip_code AND t.trip_date BETWEEN $1 AND $2
         LEFT JOIN trip_logs tl ON t.trip_code = tl.trip_code
         LEFT JOIN leave_requests lr ON d.driver_code = lr.driver_code AND lr.status = 'approved'
           AND lr.leave_date BETWEEN $1 AND $2
         GROUP BY d.driver_code, d.full_name, d.status ORDER BY d.driver_code`,
        params
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },
};

module.exports = { tripLogController, reportController };
