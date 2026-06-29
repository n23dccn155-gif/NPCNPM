// gpsAlertEngine.js: Bộ phát hiện cảnh báo GPS
// 3 rule:
//   1. off_route  : khoảng cách từ xe tới polyline tuyến > ngưỡng
//   2. over_speed : tốc độ > ngưỡng
//   3. long_stop  : xe đứng yên (speed < 5 km/h) > ngưỡng giây
//   4. no_signal  : không nhận tín hiệu > ngưỡng giây (kiểm tra ở cron job, không ở ingest)
//
// Tất cả rule đều có cooldown để tránh spam.
// Lưu cache cooldown trong memory (Map) — production nên dùng Redis.

const memoryCache = new Map(); // key: `${bus_id}:${alert_type}` -> lastAlertTimestamp

function isInCooldown(busId, alertType, cooldownSeconds) {
  const key = `${busId}:${alertType}`;
  const last = memoryCache.get(key);
  if (!last) return false;
  const elapsed = (Date.now() - last) / 1000;
  return elapsed < cooldownSeconds;
}

function markAlerted(busId, alertType) {
  const key = `${busId}:${alertType}`;
  memoryCache.set(key, Date.now());
}

/**
 * Tính khoảng cách từ điểm tới polyline (m)
 * Inline copy để giảm dependency, có thể refactor dùng chung controller sau.
 */
function pointToPolylineMinDistance(lat, lon, points) {
  if (!points || points.length === 0) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  function dist(lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  if (points.length === 1) return dist(lat, lon, points[0].latitude, points[0].longitude);
  let min = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const ax = a.longitude, ay = a.latitude;
    const bx = b.longitude, by = b.latitude;
    const px = lon, py = lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const projX = ax + t * dx, projY = ay + t * dy;
    const d = dist(py, px, projY, projX);
    if (d < min) min = d;
  }
  return min;
}

const gpsAlertEngine = {
  /**
   * Đánh giá 1 location point để phát hiện alert.
   * @param {object} pool - pg pool
   * @param {object} ctx - { bus_id, latitude, longitude, speed_kmh, recorded_at, currentTrip }
   * @returns {Array} alerts vừa được tạo
   */
  evaluateLocation: async (pool, ctx) => {
    const { bus_id, latitude, longitude, speed_kmh, recorded_at, currentTrip } = ctx;
    const newAlerts = [];

    try {
      // Load rules
      const rulesRes = await pool.query(`SELECT * FROM alert_rules WHERE is_enabled = TRUE`);
      const rulesByType = Object.fromEntries(rulesRes.rows.map(r => [r.alert_type, r]));

      // ============================================================
      // Rule 1: OVER_SPEED (dựa trên tốc độ thiết bị gửi về)
      // ============================================================
      const speedRule = rulesByType['over_speed'];
      if (speedRule && Number(speed_kmh) > Number(speedRule.threshold_value)) {
        if (!isInCooldown(bus_id, 'over_speed', speedRule.cooldown_seconds)) {
          const licenseRes = await pool.query('SELECT license_plate FROM buses WHERE bus_id = $1', [bus_id]);
          const license = licenseRes.rows[0]?.license_plate || `Bus #${bus_id}`;
          const insert = await pool.query(
            `INSERT INTO gps_alerts
             (bus_id, alert_type, severity, message, metadata)
             VALUES ($1, 'over_speed', 'warning', $2, $3)
             RETURNING *`,
            [
              bus_id,
              `${license} chạy quá tốc độ: ${Number(speed_kmh).toFixed(1)} km/h (giới hạn ${speedRule.threshold_value} km/h)`,
              JSON.stringify({
                speed_kmh: Number(speed_kmh),
                threshold: Number(speedRule.threshold_value),
                recorded_at
              })
            ]
          );
          newAlerts.push(insert.rows[0]);
          markAlerted(bus_id, 'over_speed');

          // Gửi notification cho dispatcher + manager
          await gpsAlertEngine._notifyAlert(pool, insert.rows[0], currentTrip);
        }
      }

      // ============================================================
      // Rule 2: OFF_ROUTE (chỉ kiểm tra khi xe đang chạy trong 1 trip có route_code)
      // ============================================================
      const offRouteRule = rulesByType['off_route'];
      if (offRouteRule && currentTrip && currentTrip.route_code) {
        // Lấy polyline của tuyến hiện tại
        const polyRes = await pool.query(
          `SELECT latitude, longitude FROM route_polylines
           WHERE route_code = $1 AND direction_type = $2
           ORDER BY point_order ASC`,
          [currentTrip.route_code, currentTrip.direction_type]
        );
        if (polyRes.rows.length > 0) {
          const distance = pointToPolylineMinDistance(latitude, longitude, polyRes.rows);
          if (distance > Number(offRouteRule.threshold_value)) {
            if (!isInCooldown(bus_id, 'off_route', offRouteRule.cooldown_seconds)) {
              const licenseRes = await pool.query('SELECT license_plate FROM buses WHERE bus_id = $1', [bus_id]);
              const license = licenseRes.rows[0]?.license_plate || `Bus #${bus_id}`;
              const insert = await pool.query(
                `INSERT INTO gps_alerts
                 (bus_id, alert_type, severity, message, metadata)
                 VALUES ($1, 'off_route', 'warning', $2, $3)
                 RETURNING *`,
                [
                  bus_id,
                  `${license} (Tuyến ${currentTrip.route_code}) bị lệch tuyến ${distance.toFixed(0)} m (cho phép ${offRouteRule.threshold_value} m)`,
                  JSON.stringify({
                    distance_m: Math.round(distance),
                    threshold_m: Number(offRouteRule.threshold_value),
                    route_code: currentTrip.route_code,
                    direction_type: currentTrip.direction_type,
                    recorded_at
                  })
                ]
              );
              newAlerts.push(insert.rows[0]);
              markAlerted(bus_id, 'off_route');
              await gpsAlertEngine._notifyAlert(pool, insert.rows[0], currentTrip);
            }
          } else {
            // Reset cooldown khi xe đã trở lại tuyến
            memoryCache.delete(`${bus_id}:off_route`);
          }
        }
      }

      // ============================================================
      // Rule 3: LONG_STOP (xe đứng yên > ngưỡng giây)
      // Cần so sánh với location trước đó để tính thời gian dừng.
      // ============================================================
      const longStopRule = rulesByType['long_stop'];
      if (longStopRule && Number(speed_kmh) < 5 && currentTrip) {
        // Lấy location gần nhất trước đó (trong vòng 1 giờ)
        const prevRes = await pool.query(
          `SELECT recorded_at, speed_kmh, latitude, longitude
           FROM gps_locations
           WHERE bus_id = $1 AND recorded_at < $2 AND recorded_at > ($2::timestamp - INTERVAL '1 hour')
           ORDER BY recorded_at DESC
           LIMIT 1`,
          [bus_id, recorded_at]
        );
        if (prevRes.rows.length) {
          const prev = prevRes.rows[0];
          const stopDurationSec = (new Date(recorded_at) - new Date(prev.recorded_at)) / 1000;
          if (stopDurationSec >= Number(longStopRule.threshold_value)) {
            if (!isInCooldown(bus_id, 'long_stop', longStopRule.cooldown_seconds)) {
              const licenseRes = await pool.query('SELECT license_plate FROM buses WHERE bus_id = $1', [bus_id]);
              const license = licenseRes.rows[0]?.license_plate || `Bus #${bus_id}`;
              const insert = await pool.query(
                `INSERT INTO gps_alerts
                 (bus_id, alert_type, severity, message, metadata)
                 VALUES ($1, 'long_stop', 'info', $2, $3)
                 RETURNING *`,
                [
                  bus_id,
                  `${license} (Tuyến ${currentTrip.route_code}) dừng đỗ ${Math.floor(stopDurationSec / 60)} phút liên tục`,
                  JSON.stringify({
                    stop_duration_sec: Math.round(stopDurationSec),
                    threshold_sec: Number(longStopRule.threshold_value),
                    latitude,
                    longitude,
                    recorded_at
                  })
                ]
              );
              newAlerts.push(insert.rows[0]);
              markAlerted(bus_id, 'long_stop');
              await gpsAlertEngine._notifyAlert(pool, insert.rows[0], currentTrip);
            }
          }
        }
      } else if (Number(speed_kmh) >= 5) {
        // Reset khi xe đã chạy lại
        memoryCache.delete(`${bus_id}:long_stop`);
      }
    } catch (err) {
      console.error('[alertEngine] error:', err.message);
    }

    return newAlerts;
  },

  /**
   * Gửi notification cho dispatcher + manager khi có alert
   */
  _notifyAlert: async (pool, alert, currentTrip) => {
    try {
      const { emitToUser, broadcast } = require('../sockets/socketManager');
      // Dispatcher: người tạo plan hoặc tất cả dispatcher
      const dispatchers = await pool.query(
        `SELECT user_id FROM users WHERE role = 'dispatcher' AND status = 'active'`
      );
      const managers = await pool.query(
        `SELECT user_id FROM users WHERE role = 'manager' AND status = 'active'`
      );
      const titleMap = {
        off_route: 'Cảnh báo lệch tuyến',
        over_speed: 'Cảnh báo quá tốc độ',
        long_stop: 'Cảnh báo dừng đỗ lâu',
        no_signal: 'Cảnh báo mất tín hiệu'
      };
      const title = titleMap[alert.alert_type] || 'Cảnh báo GPS';

      const targets = [...dispatchers.rows, ...managers.rows];
      for (const u of targets) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, content) VALUES ($1, $2, $3)`,
          [u.user_id, title, alert.message]
        );
        emitToUser(u.user_id, 'GPS_ALERT', alert);
        emitToUser(u.user_id, 'NEW_NOTIFICATION', { title, content: alert.message });
      }
    } catch (e) {
      console.error('[alertEngine._notifyAlert] error:', e.message);
    }
  },

  // Reset cache (dùng cho test)
  _resetCache: () => memoryCache.clear()
};

module.exports = gpsAlertEngine;