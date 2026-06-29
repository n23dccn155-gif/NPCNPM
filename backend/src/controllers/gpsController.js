// gpsController.js: Quản lý GPS - thiết bị, vị trí, cảnh báo
// Module này gồm 4 nhóm nghiệp vụ:
//   1. Devices  : đăng ký / quản lý thiết bị GPS gắn trên xe
//   2. Ingest   : nhận dữ liệu vị trí (POST /api/gps/ingest) - "cánh cửa" cho thiết bị
//   3. Tracking : cung cấp vị trí mới nhất / lịch sử cho frontend
//   4. Alerts   : quản lý rule + xem cảnh báo + alert engine (chạy trong ingest)
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');
const { emitToUser, broadcast } = require('../sockets/socketManager');
const alertEngine = require('../utils/gpsAlertEngine');

// ============== HELPERS ==============

/**
 * Haversine - khoảng cách giữa 2 điểm (m)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // bán kính Trái Đất (m)
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Khoảng cách từ 1 điểm tới đoạn thẳng (đơn vị m)
 * Dùng cho kiểm tra lệch tuyến: lấy điểm gần nhất trên polyline.
 */
function pointToPolylineMinDistance(lat, lon, points) {
  if (!points || points.length === 0) return Infinity;
  if (points.length === 1) {
    return haversineDistance(lat, lon, points[0].latitude, points[0].longitude);
  }
  let min = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    // chiếu (lat, lon) xuống đoạn a-b bằng cách tính projection
    const ax = a.longitude, ay = a.latitude;
    const bx = b.longitude, by = b.latitude;
    const px = lon, py = lat;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const projX = ax + t * dx;
    const projY = ay + t * dy;
    const d = haversineDistance(py, px, projY, projX);
    if (d < min) min = d;
  }
  return min;
}

// ============== CONTROLLER ==============

const gpsController = {
  // ============================================================
  // DEVICES (Quản lý thiết bị GPS)
  // ============================================================

  // POST /api/gps/devices - đăng ký thiết bị mới
  registerDevice: async (req, res, next) => {
    try {
      const { bus_id, device_code, vendor, sim_number, protocol } = req.body;
      if (!bus_id || !device_code) {
        return error(res, 'Thiếu bus_id hoặc device_code', 400);
      }
      // Check bus tồn tại
      const busRes = await pool.query('SELECT bus_id FROM buses WHERE bus_id = $1', [bus_id]);
      if (!busRes.rows.length) return error(res, 'Xe buýt không tồn tại', 404);

      // Trước khi thêm, deactivate thiết bị cũ của xe này (nếu có)
      await pool.query("UPDATE gps_devices SET status = 'inactive' WHERE bus_id = $1 AND status = 'active'", [bus_id]);

      const result = await pool.query(
        `INSERT INTO gps_devices (bus_id, device_code, vendor, sim_number, protocol)
         VALUES ($1, $2, $3, $4, COALESCE($5, 'http'))
         RETURNING *`,
        [bus_id, device_code, vendor || null, sim_number || null, protocol]
      );
      return success(res, result.rows[0], 'Đăng ký thiết bị GPS thành công', 201);
    } catch (err) {
      // Lỗi unique constraint trên device_code
      if (err.code === '23505') {
        return error(res, `Mã thiết bị "${req.body.device_code}" đã tồn tại`, 409);
      }
      next(err);
    }
  },

  // GET /api/gps/devices - danh sách thiết bị
  listDevices: async (req, res, next) => {
    try {
      const result = await pool.query(`
        SELECT d.*, b.license_plate, b.status AS bus_status
        FROM gps_devices d
        JOIN buses b ON d.bus_id = b.bus_id
        ORDER BY d.bus_id, d.installed_at DESC
      `);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // PATCH /api/gps/devices/:id - cập nhật trạng thái
  updateDevice: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!['active', 'inactive', 'lost'].includes(status)) {
        return error(res, 'Trạng thái không hợp lệ', 400);
      }
      const result = await pool.query(
        `UPDATE gps_devices SET status = $1 WHERE device_id = $2 RETURNING *`,
        [status, id]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy thiết bị', 404);
      return success(res, result.rows[0], 'Cập nhật trạng bị thành công');
    } catch (err) { next(err); }
  },

  // ============================================================
  // INGEST (Bước 2: Cánh cửa nhận dữ liệu từ thiết bị GPS)
  // ============================================================

  // POST /api/gps/ingest
  // Body: { device_code, latitude, longitude, speed_kmh?, heading?, altitude?, accuracy_m?, recorded_at? }
  // Auth: KHÔNG yêu cầu JWT (thiết bị GPS dùng API key riêng qua header 'x-gps-key')
  ingest: async (req, res, next) => {
    try {
      const {
        device_code, latitude, longitude,
        speed_kmh = 0, heading = 0,
        altitude = null, accuracy_m = null,
        recorded_at = null
      } = req.body;

      // Validate payload
      if (!device_code || latitude == null || longitude == null) {
        return error(res, 'Thiếu device_code / latitude / longitude', 400);
      }
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return error(res, 'Tọa độ không hợp lệ', 400);
      }

      // Tìm thiết bị
      const devRes = await pool.query(
        `SELECT device_id, bus_id, status FROM gps_devices WHERE device_code = $1`,
        [device_code]
      );
      if (!devRes.rows.length) {
        return error(res, `Không tìm thấy thiết bị với mã "${device_code}"`, 404);
      }
      const device = devRes.rows[0];
      if (device.status !== 'active') {
        return error(res, `Thiết bị "${device_code}" không hoạt động`, 403);
      }

      // Lưu location
      const recordedTime = recorded_at ? new Date(recorded_at) : new Date();
      const locRes = await pool.query(
        `INSERT INTO gps_locations
         (device_id, bus_id, latitude, longitude, speed_kmh, heading, altitude, accuracy_m, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING location_id, bus_id, latitude, longitude, speed_kmh, heading, recorded_at`,
        [device.device_id, device.bus_id, latitude, longitude, speed_kmh, heading, altitude, accuracy_m, recordedTime]
      );
      const location = locRes.rows[0];

      // Update last_seen_at trên thiết bị
      await pool.query(
        `UPDATE gps_devices SET last_seen_at = CURRENT_TIMESTAMP WHERE device_id = $1`,
        [device.device_id]
      );

      // Tìm chuyến xe đang chạy của bus này (để gắn vị trí với trip)
      const tripRes = await pool.query(
        `SELECT t.trip_id, t.group_id, tg.plan_id, rd.route_code, rd.direction_type
         FROM assignments a
         JOIN trip_groups tg ON a.group_id = tg.group_id
         JOIN trips t ON t.group_id = tg.group_id
         JOIN route_directions rd ON t.direction_id = rd.direction_id
         WHERE a.bus_id = $1 AND a.status = 'active'
           AND t.status IN ('assigned', 'running')
           AND t.actual_departure IS NOT NULL
         ORDER BY t.scheduled_departure DESC
         LIMIT 1`,
        [device.bus_id]
      );
      const currentTrip = tripRes.rows[0] || null;

      // ======= Bước 5: ALERT ENGINE =======
      // Chạy rule để phát hiện: lệch tuyến, quá tốc độ, dừng đỗ bất thường
      const alerts = await alertEngine.evaluateLocation(pool, {
        bus_id: device.bus_id,
        latitude,
        longitude,
        speed_kmh,
        recorded_at: recordedTime,
        currentTrip
      });

      // Broadcast realtime qua Socket.io - dispatcher/manager nghe để cập nhật bản đồ
      const payload = {
        bus_id: device.bus_id,
        device_code,
        latitude,
        longitude,
        speed_kmh,
        heading,
        recorded_at: recordedTime,
        trip_id: currentTrip?.trip_id || null,
        route_code: currentTrip?.route_code || null
      };
      broadcast('BUS_LOCATION', payload);

      // Nếu có alert, broadcast từng cái để UI hiển thị popup ngay
      if (alerts.length > 0) {
        for (const a of alerts) {
          broadcast('GPS_ALERT', a);
        }
      }

      return success(res, {
        location,
        alerts_count: alerts.length,
        alerts
      }, 'Đã ghi nhận vị trí', 201);
    } catch (err) { next(err); }
  },

  // ============================================================
  // TRACKING (Cung cấp dữ liệu cho frontend)
  // ============================================================

  // GET /api/gps/tracking - vị trí hiện tại của tất cả xe active
  getCurrentLocations: async (req, res, next) => {
    try {
      // Lấy location mới nhất cho mỗi bus (dùng DISTINCT ON)
      const result = await pool.query(`
        SELECT DISTINCT ON (l.bus_id)
          l.bus_id, l.latitude, l.longitude, l.speed_kmh, l.heading,
          l.recorded_at, l.received_at,
          b.license_plate, b.status AS bus_status,
          d.device_code,
          a.driver_id, drv.full_name AS driver_name,
          t.trip_id, t.group_id, tg.group_name,
          rd.route_code, rd.direction_type
        FROM gps_locations l
        JOIN buses b ON l.bus_id = b.bus_id
        LEFT JOIN gps_devices d ON d.device_id = l.device_id AND d.status = 'active'
        LEFT JOIN assignments a ON a.bus_id = l.bus_id AND a.status = 'active'
        LEFT JOIN drivers drv ON a.driver_id = drv.driver_id
        LEFT JOIN trip_groups tg ON a.group_id = tg.group_id
        LEFT JOIN trips t ON t.group_id = tg.group_id
          AND t.status IN ('assigned', 'running')
          AND t.actual_departure IS NOT NULL
        LEFT JOIN route_directions rd ON t.direction_id = rd.direction_id
        ORDER BY l.bus_id, l.recorded_at DESC
      `);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // GET /api/gps/tracking/:busId - vị trí mới nhất của 1 xe
  getCurrentByBus: async (req, res, next) => {
    try {
      const { busId } = req.params;
      const result = await pool.query(`
        SELECT l.*, b.license_plate, d.device_code
        FROM gps_locations l
        JOIN buses b ON l.bus_id = b.bus_id
        LEFT JOIN gps_devices d ON d.device_id = l.device_id AND d.status = 'active'
        WHERE l.bus_id = $1
        ORDER BY l.recorded_at DESC
        LIMIT 1
      `, [busId]);
      if (!result.rows.length) return error(res, 'Chưa có dữ liệu vị trí cho xe này', 404);
      return success(res, result.rows[0]);
    } catch (err) { next(err); }
  },

  // GET /api/gps/history/:busId - lịch sử hành trình
  getHistory: async (req, res, next) => {
    try {
      const { busId } = req.params;
      const { from, to, limit = 500 } = req.query;

      const lim = Math.min(Math.max(parseInt(limit, 10) || 500, 1), 5000);
      const conditions = ['bus_id = $1'];
      const params = [busId];
      let idx = 1;
      if (from) { idx++; conditions.push(`recorded_at >= $${idx}`); params.push(from); }
      if (to)   { idx++; conditions.push(`recorded_at <= $${idx}`); params.push(to); }

      const result = await pool.query(
        `SELECT location_id, latitude, longitude, speed_kmh, heading, recorded_at
         FROM gps_locations
         WHERE ${conditions.join(' AND ')}
         ORDER BY recorded_at ASC
         LIMIT ${lim}`,
        params
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // ============================================================
  // ROUTE POLYLINES (quỹ đạo tuyến - để vẽ & check lệch tuyến)
  // ============================================================

  upsertPolyline: async (req, res, next) => {
    try {
      const { route_code, direction_type, points } = req.body;
      if (!route_code || !direction_type || !Array.isArray(points) || !points.length) {
        return error(res, 'Thiếu route_code / direction_type / points', 400);
      }
      if (!['outbound', 'inbound'].includes(direction_type)) {
        return error(res, 'direction_type phải là outbound hoặc inbound', 400);
      }

      // Lấy direction_id nếu có
      const dirRes = await pool.query(
        `SELECT direction_id FROM route_directions WHERE route_code = $1 AND direction_type = $2`,
        [route_code, direction_type]
      );
      const directionId = dirRes.rows[0]?.direction_id || null;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Xóa polyline cũ
        await client.query(
          `DELETE FROM route_polylines WHERE route_code = $1 AND direction_type = $2`,
          [route_code, direction_type]
        );
        // Chèn mới
        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          await client.query(
            `INSERT INTO route_polylines (route_code, direction_type, direction_id, point_order, latitude, longitude)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [route_code, direction_type, directionId, i + 1, p.latitude, p.longitude]
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      return success(res, { count: points.length }, `Đã lưu ${points.length} điểm cho tuyến ${route_code}`);
    } catch (err) { next(err); }
  },

  getPolyline: async (req, res, next) => {
    try {
      const { routeCode, directionType } = req.params;
      const result = await pool.query(
        `SELECT point_order, latitude, longitude
         FROM route_polylines
         WHERE route_code = $1 AND direction_type = $2
         ORDER BY point_order ASC`,
        [routeCode, directionType]
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  // ============================================================
  // ALERTS (Quản lý cảnh báo)
  // ============================================================

  listAlerts: async (req, res, next) => {
    try {
      const { status = 'new', alert_type, bus_id, from, to, limit = 100 } = req.query;
      const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
      const conditions = [];
      const params = [];
      let idx = 0;
      if (status)     { idx++; conditions.push(`a.status = $${idx}`); params.push(status); }
      if (alert_type) { idx++; conditions.push(`a.alert_type = $${idx}`); params.push(alert_type); }
      if (bus_id)     { idx++; conditions.push(`a.bus_id = $${idx}`); params.push(bus_id); }
      if (from)       { idx++; conditions.push(`a.created_at >= $${idx}`); params.push(from); }
      if (to)         { idx++; conditions.push(`a.created_at <= $${idx}`); params.push(to); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT a.*, b.license_plate, l.latitude, l.longitude, l.speed_kmh, u.full_name AS acknowledged_by_name
         FROM gps_alerts a
         LEFT JOIN buses b ON a.bus_id = b.bus_id
         LEFT JOIN gps_locations l ON a.location_id = l.location_id
         LEFT JOIN users u ON a.acknowledged_by = u.user_id
         ${where}
         ORDER BY a.created_at DESC
         LIMIT ${lim}`,
        params
      );
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  acknowledgeAlert: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const result = await pool.query(
        `UPDATE gps_alerts
         SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP
         WHERE alert_id = $2 AND status = 'new'
         RETURNING *`,
        [userId, id]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy cảnh báo hoặc đã xử lý', 404);
      return success(res, result.rows[0], 'Đã xác nhận cảnh báo');
    } catch (err) { next(err); }
  },

  resolveAlert: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `UPDATE gps_alerts SET status = 'resolved'
         WHERE alert_id = $1 AND status <> 'resolved'
         RETURNING *`,
        [id]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy cảnh báo', 404);
      return success(res, result.rows[0], 'Đã đóng cảnh báo');
    } catch (err) { next(err); }
  },

  // ============================================================
  // RULES (cấu hình rule)
  // ============================================================

  listRules: async (req, res, next) => {
    try {
      const result = await pool.query(`SELECT * FROM alert_rules ORDER BY alert_type`);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  updateRule: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { is_enabled, threshold_value, cooldown_seconds } = req.body;
      const result = await pool.query(
        `UPDATE alert_rules
         SET is_enabled = COALESCE($1, is_enabled),
             threshold_value = COALESCE($2, threshold_value),
             cooldown_seconds = COALESCE($3, cooldown_seconds),
             updated_at = CURRENT_TIMESTAMP
         WHERE rule_id = $4
         RETURNING *`,
        [is_enabled, threshold_value, cooldown_seconds, id]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy rule', 404);
      return success(res, result.rows[0], 'Cập nhật rule thành công');
    } catch (err) { next(err); }
  }
};

// Export helper để alertEngine dùng
gpsController.haversineDistance = haversineDistance;
gpsController.pointToPolylineMinDistance = pointToPolylineMinDistance;

module.exports = gpsController;