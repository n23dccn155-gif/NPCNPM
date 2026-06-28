const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

function timeToMinutes(value) {
  const [hours, minutes] = String(value).split(':').map(Number);
  return hours * 60 + minutes;
}

function buildTimestamp(dateStr, minutes) {
  const dayOffset = Math.floor(minutes / 1440);
  const minuteOfDay = ((minutes % 1440) + 1440) % 1440;
  const base = new Date(`${dateStr}T00:00:00`);
  base.setDate(base.getDate() + dayOffset);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
  const mm = String(minuteOfDay % 60).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:00`;
}

function calculateSchedulingMetrics(route, outbound, inbound) {
  const startMin = timeToMinutes(route.start_time);
  const endMin = timeToMinutes(route.end_time);
  const expectedTripsPerDirection = Number(route.expected_trips_per_day);
  
  const outboundTravel = Number(outbound.travel_time_minutes) || 30;
  const inboundTravel = Number(inbound.travel_time_minutes) || 30;
  const roundTripTravelTime = outboundTravel + inboundTravel;
  
  const operatingTimeFund = (endMin - startMin) - roundTripTravelTime;
  
  let calculatedHeadwayMinutes = Number(route.headway_minutes) || 30;
  if (expectedTripsPerDirection > 1 && operatingTimeFund > 0) {
    calculatedHeadwayMinutes = Math.round(operatingTimeFund / (expectedTripsPerDirection - 1));
  }
  
  const longLayoverMinutes = Number(route.min_rest_time_minutes) || 30;
  const maxCycleTimeMinutes = roundTripTravelTime + longLayoverMinutes;
  
  const suggestedOperatingBuses = calculatedHeadwayMinutes > 0 ? Math.ceil(maxCycleTimeMinutes / calculatedHeadwayMinutes) : 0;
  
  return {
    startMin, endMin, expectedTripsPerDirection, totalOperationMinutes: (endMin - startMin),
    calculatedHeadwayMinutes, headwayMinutes: calculatedHeadwayMinutes, generatedTripsPerDirection: expectedTripsPerDirection,
    roundTripTimeMinutes: roundTripTravelTime, suggestedOperatingBuses
  };
}

async function getRouteDirections(client, routeCode) {
  const result = await client.query(
    `SELECT * FROM route_directions WHERE route_code = $1
     ORDER BY CASE direction_type WHEN 'outbound' THEN 1 ELSE 2 END`,
    [routeCode]
  );
  const outbound = result.rows.find(d => d.direction_type === 'outbound');
  const inbound = result.rows.find(d => d.direction_type === 'inbound');
  return { directions: result.rows, outbound, inbound };
}

const planController = {
  getAll: async (req, res, next) => {
    try {
      const { route_code, status, date, role } = req.query;
      let query = `
        SELECT p.*, r.route_name, u.full_name AS creator_name
        FROM operation_plans p
        JOIN routes r ON p.route_code = r.route_code
        JOIN users u ON p.created_by = u.user_id
      `;
      const params = [];
      const conditions = [];
      // Manager chỉ thấy kế hoạch đã submit trở lên
      if (req.user?.role === 'manager') {
        conditions.push(`p.status IN ('pending_approval','approved','rejected')`);
      }
      if (route_code) { params.push(route_code); conditions.push(`p.route_code = $${params.length}`); }
      if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }
      if (date) { params.push(date); conditions.push(`p.operation_date = $${params.length}`); }
      if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
      query += ' ORDER BY p.operation_date DESC, p.route_code';
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  getOne: async (req, res, next) => {
    try {
      const { planId } = req.params;
      const planRes = await pool.query(
        `SELECT p.*, r.route_name, r.start_time, r.end_time, r.expected_trips_per_day,
                r.headway_minutes, r.confirmed_operating_buses, u.full_name AS creator_name
         FROM operation_plans p
         JOIN routes r ON p.route_code = r.route_code
         JOIN users u ON p.created_by = u.user_id
         WHERE p.plan_id = $1`, [planId]
      );
      if (!planRes.rows.length) return error(res, 'Không tìm thấy kế hoạch vận doanh', 404);
      const plan = planRes.rows[0];
      const { directions, outbound, inbound } = await getRouteDirections(pool, plan.route_code);
      plan.directions = directions;
      if (outbound && inbound && Number(plan.expected_trips_per_day) >= 2) {
        const metrics = calculateSchedulingMetrics(plan, outbound, inbound);
        plan.scheduling_metrics = {
          total_operation_minutes: metrics.totalOperationMinutes,
          calculated_headway_minutes: Number(metrics.calculatedHeadwayMinutes.toFixed(2)),
          average_headway_minutes: Number(metrics.headwayMinutes.toFixed(2)),
          headway_minutes: Number(metrics.headwayMinutes.toFixed(2)),
          round_trip_time_minutes: metrics.roundTripTimeMinutes ? Math.round(metrics.roundTripTimeMinutes) : null,
          suggested_operating_buses: metrics.suggestedOperatingBuses,
          confirmed_operating_buses: Number(plan.confirmed_operating_buses),
          expected_trips_per_direction: metrics.expectedTripsPerDirection,
          generated_trips_per_direction: metrics.generatedTripsPerDirection
        };
      }
      const groupsRes = await pool.query(
        `SELECT g.*, a.bus_id, a.driver_id, a.assignment_type,
                b.license_plate, d.full_name AS driver_name
         FROM trip_groups g
         LEFT JOIN assignments a ON g.group_id = a.group_id AND a.status = 'active'
         LEFT JOIN buses b ON a.bus_id = b.bus_id
         LEFT JOIN drivers d ON a.driver_id = d.driver_id
         WHERE g.plan_id = $1
         ORDER BY g.start_time, g.group_id`, [planId]
      );
      plan.groups = groupsRes.rows;
      const tripsRes = await pool.query(
        `SELECT t.*, tg.group_name, rd.direction_type, rd.start_point, rd.end_point
         FROM trips t
         LEFT JOIN trip_groups tg ON t.group_id = tg.group_id
         JOIN route_directions rd ON t.direction_id = rd.direction_id
         WHERE t.plan_id = $1 ORDER BY t.scheduled_departure`, [planId]
      );
      plan.trips = tripsRes.rows;
      return success(res, plan);
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { route_code, operation_date } = req.body;
      const dispatcherId = req.user.id;
      if (!route_code || !operation_date) return error(res, 'Vui lòng cung cấp mã tuyến và ngày vận hành', 400);
      const routeRes = await pool.query('SELECT * FROM routes WHERE route_code = $1', [route_code]);
      if (!routeRes.rows.length) return error(res, 'Tuyến không tồn tại', 404);
      if (routeRes.rows[0].status !== 'active') return error(res, 'Tuyến không hoạt động', 400);
      const existRes = await pool.query(
        'SELECT plan_id FROM operation_plans WHERE route_code = $1 AND operation_date = $2',
        [route_code, operation_date]
      );
      if (existRes.rows.length) return error(res, 'Kế hoạch cho tuyến trong ngày này đã tồn tại', 409);
      const result = await pool.query(
        `INSERT INTO operation_plans (route_code, operation_date, created_by, status)
         VALUES ($1, $2, $3, 'draft') RETURNING *`,
        [route_code, operation_date, dispatcherId]
      );
      return success(res, result.rows[0], 'Tạo kế hoạch vận doanh thành công', 201);
    } catch (err) { next(err); }
  },

  // XÓA kế hoạch nháp / bị từ chối
  deletePlan: async (req, res, next) => {
    try {
      const { planId } = req.params;
      const planRes = await pool.query('SELECT * FROM operation_plans WHERE plan_id = $1', [planId]);
      if (!planRes.rows.length) return error(res, 'Không tìm thấy kế hoạch', 404);
      if (!['draft', 'rejected'].includes(planRes.rows[0].status)) {
        return error(res, 'Chỉ được xóa kế hoạch nháp hoặc bị từ chối', 400);
      }
      await pool.query(
        `DELETE FROM assignments WHERE group_id IN (SELECT group_id FROM trip_groups WHERE plan_id = $1)`,
        [planId]
      );
      await pool.query('DELETE FROM trips WHERE plan_id = $1', [planId]);
      await pool.query('DELETE FROM trip_groups WHERE plan_id = $1', [planId]);
      await pool.query('DELETE FROM operation_plans WHERE plan_id = $1', [planId]);
      return success(res, null, 'Đã xóa kế hoạch thành công');
    } catch (err) { next(err); }
  },

  // SINH CHUYẾN 7 NGÀY + XOAY VÒNG TÀI XẾ / XE
  generateTrips: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { planId } = req.params;
      
      const planRes = await client.query('SELECT * FROM operation_plans WHERE plan_id = $1', [planId]);
      if (!planRes.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Không tìm thấy kế hoạch vận doanh', 404);
      }

      const plan = planRes.rows[0];
      if (plan.status !== 'draft') {
        await client.query('ROLLBACK');
        return error(res, 'Chỉ kế hoạch nháp mới được sinh chuyến', 400);
      }

      const routeRes = await client.query('SELECT * FROM routes WHERE route_code = $1', [plan.route_code]);
      const route = routeRes.rows[0];
      const { outbound, inbound } = await getRouteDirections(client, plan.route_code);

      if (!outbound || !inbound) {
        await client.query('ROLLBACK');
        return error(res, 'Tuyến chưa cấu hình đủ lượt đi và lượt về', 400);
      }

      // Lấy cấu hình tuyến làm tham số mặc định nếu không truyền từ body
      const travel_time = req.body.travel_time || outbound.travel_time_minutes || route.travel_time_minutes || 80;
      const headway_minutes = req.body.headway_minutes || route.headway_minutes || 15;
      const short_layover = req.body.short_layover || route.short_layover_minutes || 10;
      const long_layover = req.body.long_layover || route.long_layover_minutes || 15;
      const max_driving_minutes = req.body.max_driving_minutes || route.max_driving_minutes || 240;
      const standby_ratio = req.body.standby_ratio || route.standby_ratio || 0.15;

      const startMin = timeToMinutes(route.start_time); // e.g. 05:00
      const endMin = timeToMinutes(route.end_time);     // e.g. 21:30

      await client.query(
        `DELETE FROM assignments
         WHERE group_id IN (SELECT group_id FROM trip_groups WHERE plan_id = $1)`,
        [planId]
      );
      await client.query('DELETE FROM trips WHERE plan_id = $1', [planId]);
      await client.query('DELETE FROM trip_groups WHERE plan_id = $1', [planId]);

      const baseDate = new Date(plan.operation_date);
      const expectedTrips = route.expected_trips_per_day || 50;
      const requiredBuses = Math.ceil((travel_time * 2 + route.min_rest_time_minutes) / headway_minutes);
      
      const allDrivers = [];
      const allGeneratedTrips = [];

      const startLocalDate = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate()
      );

      for (let day = 0; day < 7; day++) {
        const curDate = new Date(startLocalDate);
        curDate.setDate(startLocalDate.getDate() + day);
        const y = curDate.getFullYear();
        const m = String(curDate.getMonth() + 1).padStart(2, '0');
        const d = String(curDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        const dailyGroups = {};
        for (let i = 1; i <= requiredBuses; i++) {
            dailyGroups[i] = {
                busId: i,
                startTime: null,
                endTime: null,
                trips: [],
                dateStr: dateStr
            };
        }

        for (let i = 0; i < expectedTrips; i++) {
            const busId = (i % requiredBuses) + 1;
            const group = dailyGroups[busId];
            
            const outStartTime = startMin + i * headway_minutes;
            if (group.startTime === null) group.startTime = outStartTime;
            
            const outEndTime = outStartTime + travel_time;
            const inStartTime = outEndTime; // Quay đầu ngay lập tức
            const inEndTime = inStartTime + travel_time;
            
            const outTrip = {
                direction_id: outbound.direction_id,
                startLoc: 'A',
                startTime: outStartTime,
                endLoc: 'B',
                endTime: outEndTime,
                scheduled_departure: buildTimestamp(dateStr, outStartTime),
                scheduled_arrival: buildTimestamp(dateStr, outEndTime)
            };
            
            const inTrip = {
                direction_id: inbound.direction_id,
                startLoc: 'B',
                startTime: inStartTime,
                endLoc: 'A',
                endTime: inEndTime,
                scheduled_departure: buildTimestamp(dateStr, inStartTime),
                scheduled_arrival: buildTimestamp(dateStr, inEndTime)
            };
            
            group.trips.push(outTrip, inTrip);
            allGeneratedTrips.push(outTrip, inTrip);
            group.endTime = inEndTime;
        }
        
        Object.values(dailyGroups).forEach(g => {
            if (g.trips.length > 0) {
                allDrivers.push(g);
            }
        });
      }

      allGeneratedTrips
        .sort((a, b) => new Date(a.scheduled_departure) - new Date(b.scheduled_departure))
        .forEach((trip, index) => {
          trip.trip_order = index + 1;
        });

      for (const d of allDrivers) {
          const groupName = `Nhóm ${d.busId}`;
          const groupStart = buildTimestamp(d.dateStr, d.startTime);
          const groupEnd = buildTimestamp(d.dateStr, d.endTime);

          const groupRes = await client.query(
            `INSERT INTO trip_groups (plan_id, group_name, start_time, end_time, status)
             VALUES ($1, $2, $3, $4, 'unassigned')
             RETURNING group_id`,
            [planId, groupName, groupStart, groupEnd]
          );
          const groupId = groupRes.rows[0].group_id;

          for (const trip of d.trips) {
              await client.query(
                `INSERT INTO trips (
                   plan_id, direction_id, group_id, trip_order,
                   scheduled_departure, scheduled_arrival, status
                 ) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')`,
                [
                  planId, trip.direction_id, groupId, trip.trip_order,
                  trip.scheduled_departure, trip.scheduled_arrival
                ]
              );
          }
      }

      const mainDrivers = requiredBuses; // Mỗi ngày cần requiredBuses tài xế chính thức
      const standbyDrivers = Math.ceil(mainDrivers * standby_ratio);
      const totalDailyDrivers = mainDrivers + standbyDrivers;
      const totalWeeklyDrivers = Math.ceil((totalDailyDrivers * 7) / 6);

      await client.query('COMMIT');
      return success(res, {
        trips_generated: allGeneratedTrips.length,
        groups_generated: requiredBuses * 7,
        total_shifts: requiredBuses * 7,
        daily_drivers_needed: totalDailyDrivers,
        weekly_drivers_needed: totalWeeklyDrivers
      }, 'Sinh chuyến & Phân ca nâng cao thành công');
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  submitPlan: async (req, res, next) => {
    const { planId } = req.params;
    const dispatcherId = req.user.id;
    try {
      const planRes = await pool.query('SELECT * FROM operation_plans WHERE plan_id = $1', [planId]);
      if (!planRes.rows.length) return error(res, 'Không tìm thấy kế hoạch vận doanh', 404);
      const plan = planRes.rows[0];
      const tripsCount = await pool.query('SELECT COUNT(*) FROM trips WHERE plan_id = $1', [planId]);
      if (Number(tripsCount.rows[0].count) === 0) return error(res, 'Kế hoạch chưa có chuyến xe nào được sinh', 400);
      const unassigned = await pool.query(
        `SELECT COUNT(*) FROM trip_groups WHERE plan_id = $1 AND status = 'unassigned'`, [planId]
      );
      if (Number(unassigned.rows[0].count) > 0) return error(res, 'Còn nhóm chuyến chưa được phân công', 400);
      const updateRes = await pool.query(
        `UPDATE operation_plans SET status = 'pending_approval', submitted_by = $1 WHERE plan_id = $2 RETURNING *`,
        [dispatcherId, planId]
      );
      const managers = await pool.query(`SELECT user_id FROM users WHERE role = 'manager' AND status = 'active'`);
      const dateStr = plan.operation_date.toISOString().split('T')[0];
      for (const mgr of managers.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, content) VALUES ($1, 'Kế hoạch chờ duyệt', $2)`,
          [mgr.user_id, `Kế hoạch tuyến ${plan.route_code} bắt đầu ${dateStr} đang chờ duyệt.`]
        );
      }
      return success(res, updateRes.rows[0], 'Gửi duyệt kế hoạch thành công');
    } catch (err) { next(err); }
  },

  reviewPlan: async (req, res, next) => {
    const { planId } = req.params;
    const { decision, reject_reason } = req.body;
    const managerId = req.user.id;
    if (!['approve', 'reject'].includes(decision)) return error(res, 'Quyết định không hợp lệ', 400);
    try {
      const planRes = await pool.query('SELECT * FROM operation_plans WHERE plan_id = $1', [planId]);
      if (!planRes.rows.length) return error(res, 'Không tìm thấy kế hoạch vận doanh', 404);
      const plan = planRes.rows[0];
      if (plan.status !== 'pending_approval') return error(res, 'Kế hoạch không ở trạng thái chờ duyệt', 400);
      const dateStr = plan.operation_date.toISOString().split('T')[0];
      if (decision === 'approve') {
        await pool.query(
          `UPDATE operation_plans SET status = 'approved', reviewed_by = $1, reject_reason = NULL WHERE plan_id = $2`,
          [managerId, planId]
        );
        await pool.query(
          `INSERT INTO notifications (user_id, title, content) VALUES ($1,'Kế hoạch được duyệt',$2)`,
          [plan.created_by, `Kế hoạch tuyến ${plan.route_code} ngày ${dateStr} đã được duyệt.`]
        );
        return success(res, null, 'Duyệt kế hoạch thành công');
      }
      if (!reject_reason) return error(res, 'Vui lòng nhập lý do từ chối', 400);
      await pool.query(
        `UPDATE operation_plans SET status = 'rejected', reviewed_by = $1, reject_reason = $2 WHERE plan_id = $3`,
        [managerId, reject_reason, planId]
      );
      await pool.query(
        `INSERT INTO notifications (user_id, title, content) VALUES ($1,'Kế hoạch bị từ chối',$2)`,
        [plan.created_by, `Kế hoạch tuyến ${plan.route_code} ngày ${dateStr} bị từ chối. Lý do: ${reject_reason}`]
      );
      return success(res, null, 'Từ chối kế hoạch thành công');
    } catch (err) { next(err); }
  }
};

module.exports = planController;
