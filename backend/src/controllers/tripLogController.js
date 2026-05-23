// tripLogController.js + reportController.js
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const tripLogController = {
  getAll: async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT tl.*, t.route_code, t.trip_date, t.scheduled_departure, t.scheduled_arrival, r.route_name,
           ta.bus_id, ta.driver_code, d.full_name AS driver_name
         FROM trip_logs tl 
         JOIN trips t ON tl.trip_code = t.trip_code
         JOIN routes r ON t.route_code = r.route_code
         LEFT JOIN trip_assignments ta ON tl.assignment_id = ta.id
         LEFT JOIN drivers d ON ta.driver_code = d.driver_code
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
      const { trip_code, assignment_id, actual_departure, actual_arrival, status, note } = req.body;
      if (!trip_code || !assignment_id) return error(res, 'Thiếu thông tin bắt buộc', 400);

      // Lấy thông tin chuyến để tính delay
      const tripRes = await pool.query('SELECT trip_date, scheduled_departure FROM trips WHERE trip_code = $1', [trip_code]);
      if (!tripRes.rows.length) return error(res, 'Chuyến xe không tồn tại', 404);
      const { trip_date, scheduled_departure } = tripRes.rows[0];

      const dateStr = typeof trip_date === 'string' ? trip_date : trip_date.toISOString().split('T')[0];

      let actual_dep_ts = null;
      let actual_arr_ts = null;
      let delay_minutes = 0;

      if (actual_departure) {
        if (actual_departure.includes(':') && !actual_departure.includes('-')) {
          actual_dep_ts = new Date(`${dateStr}T${actual_departure}`);
        } else {
          actual_dep_ts = new Date(actual_departure);
        }
      }

      if (actual_arrival) {
        if (actual_arrival.includes(':') && !actual_arrival.includes('-')) {
          actual_arr_ts = new Date(`${dateStr}T${actual_arrival}`);
        } else {
          actual_arr_ts = new Date(actual_arrival);
        }
      }

      if (actual_dep_ts) {
        const scheduled = new Date(`${dateStr}T${scheduled_departure}`);
        const diff = Math.floor((actual_dep_ts - scheduled) / 60000);
        delay_minutes = diff > 0 ? diff : 0;
      }

      // Thực hiện UPSERT
      const result = await pool.query(
        `INSERT INTO trip_logs (trip_code, assignment_id, actual_departure, actual_arrival, delay_minutes, status, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (trip_code) 
         DO UPDATE SET 
           assignment_id = EXCLUDED.assignment_id,
           actual_departure = COALESCE(EXCLUDED.actual_departure, trip_logs.actual_departure),
           actual_arrival = COALESCE(EXCLUDED.actual_arrival, trip_logs.actual_arrival),
           delay_minutes = EXCLUDED.delay_minutes,
           status = EXCLUDED.status,
           note = COALESCE(EXCLUDED.note, trip_logs.note)
         RETURNING *`,
        [trip_code, assignment_id, actual_dep_ts, actual_arr_ts, delay_minutes, status || 'completed', note || null]
      );

      // Cập nhật trạng thái chuyến tương ứng
      await pool.query('UPDATE trips SET status = $1 WHERE trip_code = $2', [status || 'completed', trip_code]);

      return success(res, result.rows[0], 'Ghi nhận thực hiện chuyến thành công', 201);
    } catch (err) {
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
           SUM(CASE WHEN tl.delay_minutes = 0 AND tl.status = 'completed' THEN 1 ELSE 0 END) AS on_time_trips,
           SUM(CASE WHEN tl.delay_minutes > 0 AND tl.status = 'completed' THEN 1 ELSE 0 END) AS delayed_trips,
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
           COALESCE(AVG(tl.delay_minutes), 0) AS avg_delay_minutes
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
           (SELECT COUNT(*) FROM leave_requests WHERE driver_code = d.driver_code AND status = 'approved' AND leave_date BETWEEN $1 AND $2) AS leave_days
         FROM drivers d
         LEFT JOIN trip_assignments ta ON d.driver_code = ta.driver_code AND ta.status = 'active'
         LEFT JOIN trips t ON ta.trip_code = t.trip_code AND t.trip_date BETWEEN $1 AND $2
         LEFT JOIN trip_logs tl ON t.trip_code = tl.trip_code
         GROUP BY d.driver_code, d.full_name, d.status ORDER BY d.driver_code`,
        params
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },
};

module.exports = { tripLogController, reportController };
