// tripController.js
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return h * 60 + m;
}
const { calculateDriverSchedule, getConfigForDate } = require('./schedulerController');

const tripController = {
  getAll: async (req, res, next) => {
    try {
      const { route_code, trip_date_from, trip_date_to, trip_date } = req.query;
      
      // Tự động sinh chuyến xe (Auto-Schedule Sync) cho ngày cụ thể hoặc hôm nay nếu chưa có
      const targetDate = trip_date || new Date().toISOString().split('T')[0];
      const checkTrips = await pool.query('SELECT COUNT(*) FROM trips WHERE trip_date = $1', [targetDate]);
      
      if (parseInt(checkTrips.rows[0].count) < 40) {
        // Lấy cấu hình cho ngày targetDate
        const config = await getConfigForDate(targetDate);
        
        // Tạo chuyến xe tự động dựa vào Module Time Ring
        const driverRes = await pool.query("SELECT * FROM drivers WHERE status = 'active'");
        const busRes = await pool.query("SELECT * FROM buses WHERE status = 'active'");
        
        for (const driver of driverRes.rows) {
          const s = calculateDriverSchedule(driver, targetDate, busRes.rows, config);
          if (!s.isStandby) {
            const [baseH, baseM] = s.departureTime.split(':').map(Number);
            let currentMin = baseH * 60 + baseM;

            for (let i = 0; i < 6; i++) {
              const direction = i % 2 === 0 ? 'outbound' : 'inbound';
              const tripCode = `TR${s.route_code}-${targetDate.replace(/-/g,'').substring(4)}-${s.driver_code.substring(3)}-${i+1}`;
              
              const hStart = Math.floor(currentMin / 60) % 24;
              const mStart = currentMin % 60;
              const depTime = `${String(hStart).padStart(2, '0')}:${String(mStart).padStart(2, '0')}`;
              
              const endMin = currentMin + config.trip_duration_minutes;
              
              const hEnd = Math.floor(endMin / 60) % 24;
              const mEnd = endMin % 60;
              const arrTime = `${String(hEnd).padStart(2, '0')}:${String(mEnd).padStart(2, '0')}`;

              await pool.query(
                `INSERT INTO trips (trip_code, route_code, trip_date, direction, scheduled_departure, scheduled_arrival, status) 
                 VALUES ($1, $2, $3, $4, $5, $6, 'assigned') ON CONFLICT DO NOTHING`,
                [tripCode, s.route_code, targetDate, direction, depTime, arrTime]
              );
              await pool.query(
                `INSERT INTO trip_assignments (trip_code, driver_code, bus_id, dispatcher_id, status) 
                 VALUES ($1, $2, $3, $4, 'active') ON CONFLICT DO NOTHING`,
                [tripCode, s.driver_code, s.bus_id, req.user.id]
              );

              currentMin = endMin + config.min_break_minutes;
              if (currentMin % config.trip_frequency_minutes !== 0) {
                currentMin += (config.trip_frequency_minutes - (currentMin % config.trip_frequency_minutes));
              }
            }
          }
        }
      }

      let query = `
        SELECT t.*, r.route_name,
          ta.bus_id, ta.driver_code, ta.status AS assignment_status,
          CEIL(CAST(split_part(t.trip_code, '-', 4) AS FLOAT) / 2.0) AS round_num,
          MIN(t.scheduled_departure) OVER (PARTITION BY ta.driver_code, CEIL(CAST(split_part(t.trip_code, '-', 4) AS FLOAT) / 2.0)) AS round_start_time
        FROM trips t
        JOIN routes r ON t.route_code = r.route_code
        LEFT JOIN trip_assignments ta ON t.trip_code = ta.trip_code AND ta.status = 'active'
        WHERE 1=1
      `;
      const params = [];
      if (route_code) { params.push(route_code); query += ` AND t.route_code = $${params.length}`; }
      if (trip_date) { params.push(trip_date); query += ` AND t.trip_date = $${params.length}`; }
      if (trip_date_from) { params.push(trip_date_from); query += ` AND t.trip_date >= $${params.length}`; }
      if (trip_date_to) { params.push(trip_date_to); query += ` AND t.trip_date <= $${params.length}`; }
      query += ' ORDER BY round_num, round_start_time, ta.driver_code, t.scheduled_departure';
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
      const { trip_code, route_code, trip_date, direction, scheduled_departure, scheduled_arrival } = req.body;
      if (!trip_code || !route_code || !trip_date || !scheduled_departure || !scheduled_arrival)
        return error(res, 'Thiếu thông tin bắt buộc', 400);

      // Kiểm tra scheduled_arrival > scheduled_departure
      if (timeToMinutes(scheduled_arrival) <= timeToMinutes(scheduled_departure)) {
        return error(res, 'Giờ kết thúc dự kiến phải lớn hơn giờ xuất bến dự kiến', 400);
      }

      // Kiểm tra tuyến đang hoạt động
      const routeCheck = await pool.query('SELECT status FROM routes WHERE route_code = $1', [route_code]);
      if (!routeCheck.rows.length) return error(res, 'Tuyến xe không tồn tại', 404);
      if (routeCheck.rows[0].status !== 'active') return error(res, 'Không thể lập chuyến từ tuyến đã ngưng hoạt động', 400);

      const result = await pool.query(
        `INSERT INTO trips (trip_code, route_code, trip_date, direction, scheduled_departure, scheduled_arrival, status) 
         VALUES ($1, $2, $3, $4, $5, $6, 'unassigned') RETURNING *`,
        [trip_code, route_code, trip_date, direction || 'outbound', scheduled_departure, scheduled_arrival]
      );
      return success(res, result.rows[0], 'Lập chuyến xe thành công', 201);
    } catch (err) {
      if (err.code === '23505') return error(res, 'Mã chuyến đã tồn tại', 409);
      next(err);
    }
  },
};
module.exports = tripController;
