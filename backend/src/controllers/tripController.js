// tripController.js
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const tripController = {
  getAll: async (req, res, next) => {
    try {
      const { route_code, trip_date_from, trip_date_to } = req.query;
      let query = `
        SELECT t.*, r.route_name,
          ta.bus_id, ta.driver_code, ta.status AS assignment_status
        FROM trips t
        JOIN routes r ON t.route_code = r.route_code
        LEFT JOIN trip_assignments ta ON t.trip_code = ta.trip_code AND ta.status = 'active'
        WHERE 1=1
      `;
      const params = [];
      if (route_code) { params.push(route_code); query += ` AND t.route_code = $${params.length}`; }
      if (trip_date_from) { params.push(trip_date_from); query += ` AND t.trip_date >= $${params.length}`; }
      if (trip_date_to) { params.push(trip_date_to); query += ` AND t.trip_date <= $${params.length}`; }
      query += ' ORDER BY t.trip_date, t.scheduled_departure';
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  getOne: async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT t.*, r.route_name FROM trips t JOIN routes r ON t.route_code = r.route_code WHERE t.trip_code = $1`,
        [req.params.tripCode]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy chuyến xe', 404);
      return success(res, result.rows[0]);
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { trip_code, route_code, trip_date, scheduled_departure } = req.body;
      if (!trip_code || !route_code || !trip_date || !scheduled_departure)
        return error(res, 'Thiếu thông tin bắt buộc', 400);

      // Kiểm tra tuyến đang hoạt động
      const routeCheck = await pool.query('SELECT status FROM routes WHERE route_code = $1', [route_code]);
      if (!routeCheck.rows.length) return error(res, 'Tuyến xe không tồn tại', 404);
      if (routeCheck.rows[0].status !== 'active') return error(res, 'Không thể lập chuyến từ tuyến đã ngưng hoạt động', 400);

      const result = await pool.query(
        'INSERT INTO trips (trip_code, route_code, trip_date, scheduled_departure) VALUES ($1, $2, $3, $4) RETURNING *',
        [trip_code, route_code, trip_date, scheduled_departure]
      );
      return success(res, result.rows[0], 'Lập chuyến xe thành công', 201);
    } catch (err) {
      if (err.code === '23505') return error(res, 'Mã chuyến đã tồn tại', 409);
      next(err);
    }
  },
};
module.exports = tripController;
