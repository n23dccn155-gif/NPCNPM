// reportController.js: Nghiệp vụ thống kê báo cáo hiệu suất (XL17) theo thiết kế mới
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const reportController = {
  // Thống kê theo tuyến xe (Route KPI)
  routeReport: async (req, res, next) => {
    try {
      const queryText = `
        SELECT r.route_code, r.route_name,
               COALESCE(COUNT(t.trip_id), 0) AS total_trips,
               COALESCE(SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END), 0) AS executed_trips,
               COALESCE(SUM(CASE WHEN t.status = 'completed' AND COALESCE(t.delay_minutes, 0) = 0 THEN 1 ELSE 0 END), 0) AS on_time_trips,
               COALESCE(SUM(CASE WHEN t.status = 'completed' AND COALESCE(t.delay_minutes, 0) > 0 THEN 1 ELSE 0 END), 0) AS delayed_trips,
               COALESCE(SUM(CASE WHEN t.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_trips,
               COALESCE(
                 ROUND(
                   SUM(CASE WHEN t.status = 'completed' AND COALESCE(t.delay_minutes, 0) = 0 THEN 1 ELSE 0 END)::NUMERIC
                   / NULLIF(SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END), 0),
                   4
                 ),
                 0
               ) AS on_time_rate,
               COALESCE(ROUND(CAST(AVG(CASE WHEN t.status = 'completed' THEN t.delay_minutes ELSE NULL END) AS NUMERIC), 1), 0) AS avg_delay_minutes
        FROM routes r
        LEFT JOIN operation_plans p ON r.route_code = p.route_code
        LEFT JOIN trips t ON p.plan_id = t.plan_id
        GROUP BY r.route_code, r.route_name
        ORDER BY r.route_code
      `;
      const result = await pool.query(queryText);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Thống kê theo xe buýt (Bus KPI)
  busReport: async (req, res, next) => {
    try {
      const queryText = `
        SELECT b.bus_id, b.license_plate, b.seat_count, b.status,
               COALESCE(COUNT(DISTINCT a.assignment_id), 0) AS total_assignments,
               COALESCE(COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.trip_id END), 0) AS trips_run,
               COALESCE(COUNT(DISTINCT CASE WHEN t.status = 'cancelled' THEN t.trip_id END), 0) AS cancelled_trips,
               COALESCE(COUNT(DISTINCT ir.incident_id), 0) AS incident_count
        FROM buses b
        LEFT JOIN assignments a ON b.bus_id = a.bus_id
        LEFT JOIN trip_groups tg ON a.group_id = tg.group_id
        LEFT JOIN trips t ON tg.group_id = t.group_id
        LEFT JOIN incident_reports ir ON b.bus_id = ir.bus_id
        GROUP BY b.bus_id, b.license_plate, b.seat_count, b.status
        ORDER BY b.bus_id
      `;
      const result = await pool.query(queryText);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // Thống kê theo tài xế (Driver KPI)
  driverReport: async (req, res, next) => {
    try {
      const queryText = `
        SELECT d.driver_id, d.full_name, u.username, d.license_class, d.status,
               COALESCE(COUNT(DISTINCT a.assignment_id), 0) AS total_assignments,
               COALESCE(COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.trip_id END), 0) AS executed_trips,
               COALESCE(COUNT(DISTINCT CASE WHEN t.status = 'completed' AND COALESCE(t.delay_minutes, 0) > 0 THEN t.trip_id END), 0) AS delayed_trips,
               COALESCE(
                 ROUND(
                   CAST(
                     SUM(EXTRACT(EPOCH FROM (t.actual_arrival - t.actual_departure)) / 3600)
                     FILTER (WHERE t.actual_departure IS NOT NULL AND t.actual_arrival IS NOT NULL)
                     AS NUMERIC
                   ),
                   1
                 ),
                 0
               ) AS total_driving_hours,
               COALESCE(ROUND(CAST(AVG(CASE WHEN t.status = 'completed' THEN t.delay_minutes ELSE NULL END) AS NUMERIC), 1), 0) AS avg_delay_minutes,
               COALESCE(COUNT(DISTINCT lr.leave_id), 0) AS leaves_approved,
               COALESCE(COUNT(DISTINCT ir.incident_id), 0) AS incidents_reported
        FROM drivers d
        JOIN users u ON d.user_id = u.user_id
        LEFT JOIN assignments a ON d.driver_id = a.driver_id
        LEFT JOIN trip_groups tg ON a.group_id = tg.group_id
        LEFT JOIN trips t ON tg.group_id = t.group_id
        LEFT JOIN leave_requests lr ON d.driver_id = lr.driver_id AND lr.status = 'approved'
        LEFT JOIN incident_reports ir ON d.user_id = ir.reported_by
        GROUP BY d.driver_id, d.full_name, u.username, d.license_class, d.status
        ORDER BY d.driver_id
      `;
      const result = await pool.query(queryText);
      return success(res, result.rows);
    } catch (err) { next(err); }
  }
};

module.exports = reportController;
