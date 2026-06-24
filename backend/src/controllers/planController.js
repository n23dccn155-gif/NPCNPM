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
  const headwayMinutes = Number(route.headway_minutes);
  const totalOperationMinutes = endMin - startMin;
  const calculatedHeadwayMinutes = totalOperationMinutes / (expectedTripsPerDirection - 1);
  const roundTripTimeMinutes =
    Number(outbound.travel_time_minutes) +
    Number(outbound.turnaround_time_minutes) +
    Number(inbound.travel_time_minutes) +
    Number(inbound.turnaround_time_minutes);
  const generatedTripsPerDirection = Math.floor(totalOperationMinutes / headwayMinutes) + 1;

  return {
    startMin,
    endMin,
    expectedTripsPerDirection,
    totalOperationMinutes,
    calculatedHeadwayMinutes,
    headwayMinutes,
    generatedTripsPerDirection,
    roundTripTimeMinutes,
    suggestedOperatingBuses: Math.ceil(roundTripTimeMinutes / headwayMinutes)
  };
}

async function getRouteDirections(client, routeCode) {
  const result = await client.query(
    `SELECT *
     FROM route_directions
     WHERE route_code = $1
     ORDER BY CASE direction_type WHEN 'outbound' THEN 1 ELSE 2 END`,
    [routeCode]
  );

  const outbound = result.rows.find(direction => direction.direction_type === 'outbound');
  const inbound = result.rows.find(direction => direction.direction_type === 'inbound');

  return { directions: result.rows, outbound, inbound };
}

const planController = {
  getAll: async (req, res, next) => {
    try {
      const { route_code, status, date } = req.query;
      let query = `
        SELECT p.*, r.route_name, u.full_name AS creator_name
        FROM operation_plans p
        JOIN routes r ON p.route_code = r.route_code
        JOIN users u ON p.created_by = u.user_id
      `;
      const params = [];
      const conditions = [];

      if (route_code) {
        params.push(route_code);
        conditions.push(`p.route_code = $${params.length}`);
      }
      if (status) {
        params.push(status);
        conditions.push(`p.status = $${params.length}`);
      }
      if (date) {
        params.push(date);
        conditions.push(`p.operation_date = $${params.length}`);
      }

      if (conditions.length) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      query += ' ORDER BY p.operation_date DESC, p.route_code';

      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) {
      next(err);
    }
  },

  getOne: async (req, res, next) => {
    try {
      const { planId } = req.params;
      const planRes = await pool.query(
        `SELECT p.*,
                r.route_name,
                r.start_time,
                r.end_time,
                r.expected_trips_per_day,
                r.headway_minutes,
                r.confirmed_operating_buses,
                u.full_name AS creator_name
         FROM operation_plans p
         JOIN routes r ON p.route_code = r.route_code
         JOIN users u ON p.created_by = u.user_id
         WHERE p.plan_id = $1`,
        [planId]
      );

      if (!planRes.rows.length) {
        return error(res, 'Không tìm thấy kế hoạch vận doanh', 404);
      }

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
          round_trip_time_minutes: metrics.roundTripTimeMinutes,
          suggested_operating_buses: metrics.suggestedOperatingBuses,
          confirmed_operating_buses: Number(plan.confirmed_operating_buses),
          expected_trips_per_direction: metrics.expectedTripsPerDirection,
          generated_trips_per_direction: metrics.generatedTripsPerDirection
        };
      }

      const groupsRes = await pool.query(
        `SELECT g.*, a.bus_id, a.driver_id, b.license_plate, d.full_name AS driver_name
         FROM trip_groups g
         LEFT JOIN assignments a ON g.group_id = a.group_id AND a.status = 'active'
         LEFT JOIN buses b ON a.bus_id = b.bus_id
         LEFT JOIN drivers d ON a.driver_id = d.driver_id
         WHERE g.plan_id = $1
         ORDER BY g.group_id`,
        [planId]
      );
      plan.groups = groupsRes.rows;

      const tripsRes = await pool.query(
        `SELECT t.*, tg.group_name, rd.direction_type, rd.start_point, rd.end_point
         FROM trips t
         LEFT JOIN trip_groups tg ON t.group_id = tg.group_id
         JOIN route_directions rd ON t.direction_id = rd.direction_id
         WHERE t.plan_id = $1
         ORDER BY t.trip_order`,
        [planId]
      );
      plan.trips = tripsRes.rows;

      const standbyRes = await pool.query(
        `SELECT a.*, d.full_name AS driver_name, d.phone
         FROM assignments a
         JOIN drivers d ON a.driver_id = d.driver_id
         WHERE a.plan_id = $1 AND a.assignment_type LIKE 'standby%' AND a.status = 'active'`,
        [planId]
      );
      plan.standby_drivers = standbyRes.rows;

      const leaveRes = await pool.query(
        `SELECT l.*, d.full_name AS driver_name
         FROM leave_requests l
         JOIN drivers d ON l.driver_id = d.driver_id
         WHERE l.leave_date = $1 AND l.status = 'approved'`,
        [plan.operation_date]
      );
      const leaves = leaveRes.rows;

      // Enhance leaves with replacement info for this specific plan
      for (let l of leaves) {
        // Was this driver replaced or cleared in this plan?
        const oldAssigRes = await pool.query(
          `SELECT group_id FROM assignments WHERE plan_id = $1 AND driver_id = $2 AND status = 'replaced'`,
          [planId, l.driver_id]
        );
        if (oldAssigRes.rows.length > 0) {
          const groupId = oldAssigRes.rows[0].group_id;
          const activeAssigRes = await pool.query(
            `SELECT a.driver_id, d.full_name as driver_name 
             FROM assignments a JOIN drivers d ON a.driver_id = d.driver_id 
             WHERE a.group_id = $1 AND a.status = 'active'`,
            [groupId]
          );
          if (activeAssigRes.rows.length > 0) {
            l.replaced_by = activeAssigRes.rows[0].driver_name;
          } else {
            l.cleared = true;
          }
        }
        
        // Is driver currently actively assigned in this plan?
        const currentAssigRes = await pool.query(
          `SELECT group_id FROM assignments WHERE plan_id = $1 AND driver_id = $2 AND status = 'active'`,
          [planId, l.driver_id]
        );
        l.is_active_in_plan = currentAssigRes.rows.length > 0;
        l.not_scheduled = !l.is_active_in_plan && !l.replaced_by && !l.cleared;
      }

      // Show all approved leaves for the day, even if not scheduled
      plan.approved_leaves = leaves;

      return success(res, plan);
    } catch (err) {
      next(err);
    }
  },

  create: async (req, res, next) => {
    try {
      const { route_code, operation_date } = req.body;
      const dispatcherId = req.user.id;

      if (!route_code || !operation_date) {
        return error(res, 'Vui lòng cung cấp mã tuyến và ngày vận hành', 400);
      }

      const routeRes = await pool.query('SELECT * FROM routes WHERE route_code = $1', [route_code]);
      if (!routeRes.rows.length) {
        return error(res, 'Tuyến không tồn tại', 404);
      }
      if (routeRes.rows[0].status !== 'active') {
        return error(res, 'Tuyến không hoạt động', 400);
      }

      const existRes = await pool.query(
        'SELECT plan_id FROM operation_plans WHERE route_code = $1 AND operation_date = $2',
        [route_code, operation_date]
      );
      if (existRes.rows.length) {
        return error(res, 'Kế hoạch cho tuyến trong ngày này đã tồn tại', 409);
      }

      const result = await pool.query(
        `INSERT INTO operation_plans (route_code, operation_date, created_by, status)
         VALUES ($1, $2, $3, 'draft')
         RETURNING *`,
        [route_code, operation_date, dispatcherId]
      );

      return success(res, result.rows[0], 'Tạo kế hoạch vận doanh thành công', 201);
    } catch (err) {
      next(err);
    }
  },

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
      
      const travel_time = route.travel_time_minutes || 80;
      const headway_minutes = route.headway_minutes || 15;
      const short_layover = route.short_layover_minutes || 10;
      const long_layover = route.long_layover_minutes || 15;
      const max_driving_minutes = route.max_driving_minutes || 240;
      const standby_ratio = route.standby_ratio || 0.15;
      
      const { outbound, inbound } = await getRouteDirections(client, plan.route_code);

      if (!outbound || !inbound) {
        await client.query('ROLLBACK');
        return error(res, 'Tuyến chưa cấu hình đủ lượt đi và lượt về', 400);
      }

      const startMin = timeToMinutes(route.start_time); // e.g. 05:00
      const endMin = timeToMinutes(route.end_time);     // e.g. 21:30
      const inboundStartMin = route.inbound_start_time ? timeToMinutes(route.inbound_start_time) : startMin + 30;

      await client.query(
        `DELETE FROM assignments
         WHERE group_id IN (SELECT group_id FROM trip_groups WHERE plan_id = $1)`,
        [planId]
      );
      await client.query('DELETE FROM trips WHERE plan_id = $1', [planId]);
      await client.query('DELETE FROM trip_groups WHERE plan_id = $1', [planId]);

      const y = plan.operation_date.getFullYear();
      const m = String(plan.operation_date.getMonth() + 1).padStart(2, '0');
      const d = String(plan.operation_date.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      
      const buses = [];
      const requiredBuses = Math.ceil((travel_time * 2 + short_layover * 2) / headway_minutes);
      
      for (let i = 0; i < requiredBuses; i++) {
        let startLoc = i % 2 === 0 ? 'A' : 'B';
        let aIndex = Math.floor(i / 2);
        let bIndex = Math.floor((i - 1) / 2); // Wait, if i=0 -> A (0), i=1 -> B (0), i=2 -> A (1), i=3 -> B (1)
        if(i % 2 === 1) bIndex = Math.floor(i / 2); 
        
        let startTime = startLoc === 'A' ? startMin + (aIndex * headway_minutes) : inboundStartMin + (bIndex * headway_minutes);
        
        buses.push({
            id: i + 1,
            startLoc: startLoc,
            startTime: startTime
        });
      }

      const allDrivers = [];
      const allGeneratedTrips = [];

      buses.forEach(bus => {
          let currentLoc = bus.startLoc;
          let currentTime = bus.startTime;
          let drivingSinceRest = 0;
          let shiftCount = 1;
          
          let currentDriver = {
              busId: bus.id,
              shiftName: `Ca ${shiftCount}`,
              startLoc: currentLoc,
              startTime: currentTime,
              trips: []
          };
          
          while (currentTime <= endMin) {
              if (currentLoc === 'A' && currentTime > endMin - 60) {
                  break; 
              }
              
              let arrTime = currentTime + travel_time;
              let t = {
                  direction_id: currentLoc === 'A' ? outbound.direction_id : inbound.direction_id,
                  startLoc: currentLoc,
                  startTime: currentTime,
                  endLoc: currentLoc === 'A' ? 'B' : 'A',
                  endTime: arrTime,
                  scheduled_departure: buildTimestamp(dateStr, currentTime),
                  scheduled_arrival: buildTimestamp(dateStr, arrTime)
              };
              currentDriver.trips.push(t);
              allGeneratedTrips.push(t);
              
              drivingSinceRest += travel_time;
              
              let layover = short_layover;
              if (drivingSinceRest >= max_driving_minutes) {
                  layover = long_layover;
                  drivingSinceRest = 0;
              }
              
              currentLoc = currentLoc === 'A' ? 'B' : 'A';
              currentTime = arrTime + layover;
              
              if (currentLoc === 'A' && currentDriver.trips.length >= 5 && currentTime < endMin - 120) {
                  currentDriver.endTime = currentDriver.trips[currentDriver.trips.length-1].endTime;
                  allDrivers.push(currentDriver);
                  
                  shiftCount++;
                  currentDriver = {
                      busId: bus.id,
                      shiftName: `Ca ${shiftCount}`,
                      startLoc: currentLoc,
                      startTime: currentTime,
                      trips: []
                  };
                  drivingSinceRest = 0; 
              }
          }
          
          if (currentDriver && currentDriver.trips.length > 0) {
              if (currentLoc === 'B') {
                  let arrTime = currentTime + travel_time;
                  let t = {
                      direction_id: inbound.direction_id,
                      startLoc: 'B',
                      startTime: currentTime,
                      endLoc: 'A',
                      endTime: arrTime,
                      scheduled_departure: buildTimestamp(dateStr, currentTime),
                      scheduled_arrival: buildTimestamp(dateStr, arrTime)
                  };
                  currentDriver.trips.push(t);
                  allGeneratedTrips.push(t);
                  currentLoc = 'A';
                  currentTime = arrTime + short_layover;
              }
              currentDriver.endTime = currentDriver.trips[currentDriver.trips.length-1].endTime;
              allDrivers.push(currentDriver);
          }
      });

      allGeneratedTrips
        .sort((a, b) => new Date(a.scheduled_departure) - new Date(b.scheduled_departure))
        .forEach((trip, index) => {
          trip.trip_order = index + 1;
        });

      for (const d of allDrivers) {
          const groupName = `Xe ${d.busId} - ${d.shiftName}`;
          const groupStart = buildTimestamp(dateStr, d.startTime);
          const groupEnd = buildTimestamp(dateStr, d.endTime);

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

      const mainDrivers = allDrivers.length;
      const standbyDrivers = Math.ceil(mainDrivers * standby_ratio);
      const totalDailyDrivers = mainDrivers + standbyDrivers;
      const totalWeeklyDrivers = Math.ceil((totalDailyDrivers * 7) / 6);

      await client.query('COMMIT');
      return success(res, {
        trips_generated: allGeneratedTrips.length,
        groups_generated: requiredBuses,
        total_shifts: mainDrivers,
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
      if (!planRes.rows.length) {
        return error(res, 'Không tìm thấy kế hoạch vận doanh', 404);
      }
      const plan = planRes.rows[0];

      const tripsCount = await pool.query('SELECT COUNT(*) FROM trips WHERE plan_id = $1', [planId]);
      if (Number(tripsCount.rows[0].count) === 0) {
        return error(res, 'Kế hoạch chưa có chuyến xe nào được sinh', 400);
      }

      const unassignedGroups = await pool.query(
        "SELECT COUNT(*) FROM trip_groups WHERE plan_id = $1 AND status = 'unassigned'",
        [planId]
      );
      if (Number(unassignedGroups.rows[0].count) > 0) {
        return error(res, 'Còn nhóm chuyến chưa được phân công xe và tài xế', 400);
      }

      const updateRes = await pool.query(
        `UPDATE operation_plans
         SET status = 'pending_approval', submitted_by = $1
         WHERE plan_id = $2
         RETURNING *`,
        [dispatcherId, planId]
      );

      const managers = await pool.query("SELECT user_id FROM users WHERE role = 'manager' AND status = 'active'");
      const y = plan.operation_date.getFullYear();
      const m = String(plan.operation_date.getMonth() + 1).padStart(2, '0');
      const d = String(plan.operation_date.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      for (const manager of managers.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, content)
           VALUES ($1, 'Kế hoạch chờ duyệt', $2)`,
          [manager.user_id, `Kế hoạch vận doanh tuyến ${plan.route_code} ngày ${dateStr} đang chờ duyệt.`]
        );
      }

      return success(res, updateRes.rows[0], 'Gửi duyệt kế hoạch thành công');
    } catch (err) {
      next(err);
    }
  },

  reviewPlan: async (req, res, next) => {
    const { planId } = req.params;
    const { decision, reject_reason } = req.body;
    const managerId = req.user.id;

    if (!['approve', 'reject'].includes(decision)) {
      return error(res, 'Quyết định không hợp lệ', 400);
    }

    try {
      const planRes = await pool.query('SELECT * FROM operation_plans WHERE plan_id = $1', [planId]);
      if (!planRes.rows.length) {
        return error(res, 'Không tìm thấy kế hoạch vận doanh', 404);
      }
      const plan = planRes.rows[0];

      if (plan.status !== 'pending_approval') {
        return error(res, 'Kế hoạch không ở trạng thái chờ duyệt', 400);
      }

      const y = plan.operation_date.getFullYear();
      const m = String(plan.operation_date.getMonth() + 1).padStart(2, '0');
      const d = String(plan.operation_date.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      if (decision === 'approve') {
        await pool.query(
          `UPDATE operation_plans
           SET status = 'approved', reviewed_by = $1, reject_reason = NULL
           WHERE plan_id = $2`,
          [managerId, planId]
        );

        await pool.query(
          `INSERT INTO notifications (user_id, title, content)
           VALUES ($1, 'Kế hoạch được duyệt', $2)`,
          [plan.created_by, `Kế hoạch vận doanh tuyến ${plan.route_code} ngày ${dateStr} đã được duyệt.`]
        );

        const assignedDrivers = await pool.query(
          `SELECT DISTINCT d.user_id
           FROM assignments a
           JOIN trip_groups tg ON a.group_id = tg.group_id
           JOIN drivers d ON a.driver_id = d.driver_id
           WHERE tg.plan_id = $1 AND a.status = 'active'`,
          [planId]
        );

        for (const driver of assignedDrivers.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, title, content)
             VALUES ($1, 'Lịch chạy xe mới', $2)`,
            [driver.user_id, `Bạn có lịch phân công chuyến xe mới vào ngày ${dateStr}.`]
          );
        }

        return success(res, null, 'Duyệt kế hoạch vận doanh thành công');
      }

      if (!reject_reason) {
        return error(res, 'Vui lòng nhập lý do từ chối', 400);
      }

      await pool.query(
        `UPDATE operation_plans
         SET status = 'rejected', reviewed_by = $1, reject_reason = $2
         WHERE plan_id = $3`,
        [managerId, reject_reason, planId]
      );

      await pool.query(
        `INSERT INTO notifications (user_id, title, content)
         VALUES ($1, 'Kế hoạch bị từ chối', $2)`,
        [plan.created_by, `Kế hoạch vận doanh tuyến ${plan.route_code} ngày ${dateStr} bị từ chối. Lý do: ${reject_reason}`]
      );

      return success(res, null, 'Từ chối kế hoạch vận doanh thành công');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = planController;
