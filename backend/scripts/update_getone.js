const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/controllers/planController.js');
let content = fs.readFileSync(filePath, 'utf8');

const targetFunctionStart = content.indexOf('  getOne: async (req, res, next) => {');
const targetFunctionEnd = content.indexOf('  create: async (req, res, next) => {');

const newFunction = `  getOne: async (req, res, next) => {
    try {
      const { planId } = req.params;
      const planRes = await pool.query(
        \`SELECT p.*,
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
         WHERE p.plan_id = $1\`,
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
        \`SELECT g.*, a.bus_id, a.driver_id, b.license_plate, d.full_name AS driver_name
         FROM trip_groups g
         LEFT JOIN assignments a ON g.group_id = a.group_id AND a.status = 'active'
         LEFT JOIN buses b ON a.bus_id = b.bus_id
         LEFT JOIN drivers d ON a.driver_id = d.driver_id
         WHERE g.plan_id = $1
         ORDER BY g.group_id\`,
        [planId]
      );
      plan.groups = groupsRes.rows;

      const tripsRes = await pool.query(
        \`SELECT t.*, tg.group_name, rd.direction_type, rd.start_point, rd.end_point
         FROM trips t
         LEFT JOIN trip_groups tg ON t.group_id = tg.group_id
         JOIN route_directions rd ON t.direction_id = rd.direction_id
         WHERE t.plan_id = $1
         ORDER BY t.trip_order\`,
        [planId]
      );
      plan.trips = tripsRes.rows;

      const standbyRes = await pool.query(
        \`SELECT a.*, d.full_name AS driver_name, d.phone
         FROM assignments a
         JOIN drivers d ON a.driver_id = d.driver_id
         WHERE a.plan_id = $1 AND a.assignment_type LIKE 'standby%' AND a.status = 'active'\`,
        [planId]
      );
      plan.standby_drivers = standbyRes.rows;

      return success(res, plan);
    } catch (err) {
      next(err);
    }
  },

`;

content = content.substring(0, targetFunctionStart) + newFunction + content.substring(targetFunctionEnd);
fs.writeFileSync(filePath, content);
console.log('Successfully rewrote getOne logic.');
