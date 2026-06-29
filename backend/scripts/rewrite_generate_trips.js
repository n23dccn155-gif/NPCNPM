const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/controllers/planController.js');
let content = fs.readFileSync(filePath, 'utf8');

const targetFunctionStart = content.indexOf('  generateTrips: async (req, res, next) => {');
const targetFunctionEnd = content.indexOf('  submitPlan: async (req, res, next) => {');

if (targetFunctionStart === -1 || targetFunctionEnd === -1) {
    console.error('Could not find generateTrips or submitPlan');
    process.exit(1);
}

const newFunction = `  generateTrips: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { planId } = req.params;
      
      // Accept dynamic parameters from req.body
      const {
        travel_time = 80,
        headway_minutes = 15,
        short_layover = 10,
        long_layover = 15,
        max_driving_minutes = 240,
        standby_ratio = 0.15
      } = req.body;

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

      const startMin = timeToMinutes(route.start_time); // e.g. 05:00
      const endMin = timeToMinutes(route.end_time);     // e.g. 21:30

      await client.query(
        \`DELETE FROM assignments
         WHERE group_id IN (SELECT group_id FROM trip_groups WHERE plan_id = $1)\`,
        [planId]
      );
      await client.query('DELETE FROM trips WHERE plan_id = $1', [planId]);
      await client.query('DELETE FROM trip_groups WHERE plan_id = $1', [planId]);

      const dateStr = plan.operation_date.toISOString().split('T')[0];
      
      const buses = [];
      const requiredBuses = Math.ceil((travel_time * 2 + short_layover * 2) / headway_minutes);
      
      for (let i = 0; i < requiredBuses; i++) {
        let startLoc = i % 2 === 0 ? 'A' : 'B';
        let aIndex = Math.floor(i / 2);
        let bIndex = Math.floor((i - 1) / 2); // Wait, if i=0 -> A (0), i=1 -> B (0), i=2 -> A (1), i=3 -> B (1)
        if(i % 2 === 1) bIndex = Math.floor(i / 2); 
        
        // This is a naive start time calculation. 
        // More robust: just offset by 30 mins for Terminal B.
        let startTime = startLoc === 'A' ? startMin + (aIndex * headway_minutes) : startMin + 30 + (bIndex * headway_minutes);
        
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
              shiftName: \`Ca \${shiftCount}\`,
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
                      shiftName: \`Ca \${shiftCount}\`,
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
          const groupName = \`Xe \${d.busId} - \${d.shiftName}\`;
          const groupStart = buildTimestamp(dateStr, d.startTime);
          const groupEnd = buildTimestamp(dateStr, d.endTime);

          const groupRes = await client.query(
            \`INSERT INTO trip_groups (plan_id, group_name, start_time, end_time, status)
             VALUES ($1, $2, $3, $4, 'unassigned')
             RETURNING group_id\`,
            [planId, groupName, groupStart, groupEnd]
          );
          const groupId = groupRes.rows[0].group_id;

          for (const trip of d.trips) {
              await client.query(
                \`INSERT INTO trips (
                   plan_id, direction_id, group_id, trip_order,
                   scheduled_departure, scheduled_arrival, status
                 ) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')\`,
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

`;

const finalContent = content.substring(0, targetFunctionStart) + newFunction + content.substring(targetFunctionEnd);
fs.writeFileSync(filePath, finalContent);
console.log('Successfully rewrote generateTrips logic.');
