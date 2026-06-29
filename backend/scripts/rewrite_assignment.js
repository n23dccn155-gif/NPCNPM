const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/controllers/assignmentController.js');
let content = fs.readFileSync(filePath, 'utf8');

const targetFunctionStart = content.indexOf('  autoAssignPlan: async (req, res, next) => {');
const targetFunctionEnd = content.lastIndexOf('module.exports = assignmentController;');

if (targetFunctionStart === -1 || targetFunctionEnd === -1) {
    console.error('Could not find autoAssignPlan');
    process.exit(1);
}

const newFunction = `  autoAssignPlan: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { planId } = req.params;
      const { standbyRatio = 0.15 } = req.body;
      const dispatcherId = req.user.id;

      const planRes = await client.query('SELECT * FROM operation_plans WHERE plan_id = $1', [planId]);
      if (!planRes.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Không tìm thấy kế hoạch', 404);
      }
      const plan = planRes.rows[0];

      const groupsRes = await client.query(
        "SELECT * FROM trip_groups WHERE plan_id = $1 AND status = 'unassigned' ORDER BY group_name, start_time",
        [planId]
      );
      if (!groupsRes.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Không có nhóm chuyến nào cần phân công (hoặc đã phân công hết)', 400);
      }
      const groups = groupsRes.rows;

      const vehicleGroupsMap = {};
      groups.forEach(g => {
         const baseName = g.group_name.split(' - ')[0];
         if(!vehicleGroupsMap[baseName]) vehicleGroupsMap[baseName] = [];
         vehicleGroupsMap[baseName].push(g);
      });

      const requiredBuses = Object.keys(vehicleGroupsMap).length;
      const requiredMainDrivers = groups.length;
      const requiredStandbyDrivers = Math.ceil(requiredMainDrivers * standbyRatio);
      const totalDriversNeeded = requiredMainDrivers + requiredStandbyDrivers;

      const busesRes = await client.query(
        \`SELECT b.bus_id FROM buses b
         JOIN route_buses rb ON b.bus_id = rb.bus_id
         WHERE rb.route_code = $1 AND rb.bus_role = 'operating' AND b.status = 'active'\`,
        [plan.route_code]
      );
      const availableBuses = busesRes.rows.map(b => b.bus_id);

      const driversRes = await client.query(
        \`SELECT rd.driver_id, 
                COALESCE(COUNT(a.assignment_id), 0) AS recent_shifts
         FROM route_drivers rd
         JOIN drivers d ON rd.driver_id = d.driver_id
         LEFT JOIN assignments a ON rd.driver_id = a.driver_id 
              AND a.status = 'active'
         LEFT JOIN operation_plans p ON a.plan_id = p.plan_id 
              AND p.operation_date >= $2::date - INTERVAL '7 days'
         WHERE rd.route_code = $1 
           AND rd.status = 'active'
           AND d.status = 'working'
           AND NOT EXISTS (
             SELECT 1 FROM leave_requests l 
             WHERE l.driver_id = d.driver_id AND l.leave_date = $2 AND l.status = 'approved'
           )
         GROUP BY rd.driver_id
         ORDER BY recent_shifts ASC, rd.driver_id ASC\`,
        [plan.route_code, plan.operation_date]
      );
      
      const availableDrivers = [];
      for (const d of driversRes.rows) {
        const overlap = await client.query(
          \`SELECT 1 FROM assignments a
           WHERE a.driver_id = $1 AND a.status = 'active' AND a.plan_id = $2\`,
          [d.driver_id, plan.plan_id]
        );
        if (overlap.rows.length === 0) {
          availableDrivers.push(d.driver_id);
        }
      }

      if (availableBuses.length < requiredBuses) {
         await client.query('ROLLBACK');
         return error(res, \`Tuyến thiếu xe vận doanh. Yêu cầu \${requiredBuses}, hiện có \${availableBuses.length}\`, 400);
      }
      if (availableDrivers.length < totalDriversNeeded) {
         await client.query('ROLLBACK');
         return error(res, \`Tuyến thiếu tài xế. Yêu cầu \${totalDriversNeeded} (Chính: \${requiredMainDrivers}, Dự bị: \${requiredStandbyDrivers}), hiện có \${availableDrivers.length}\`, 400);
      }

      let busIdx = 0;
      let driverIdx = 0;

      for (const [baseName, subGroups] of Object.entries(vehicleGroupsMap)) {
         const bus_id = availableBuses[busIdx++];
         for (const sg of subGroups) {
            const driver_id = availableDrivers[driverIdx++];
            await client.query(
              \`INSERT INTO assignments (plan_id, group_id, bus_id, driver_id, assignment_type, assigned_by, status)
               VALUES ($1, $2, $3, $4, 'main', $5, 'active')\`,
              [plan.plan_id, sg.group_id, bus_id, driver_id, dispatcherId]
            );
            await client.query(
              \`UPDATE trip_groups SET status = 'assigned' WHERE group_id = $1\`,
              [sg.group_id]
            );
         }
      }

      for (let i = 0; i < requiredStandbyDrivers; i++) {
          const driver_id = availableDrivers[driverIdx++];
          const type = i < requiredStandbyDrivers / 2 ? 'standby_morning' : 'standby_afternoon';
          
          await client.query(
              \`INSERT INTO assignments (plan_id, group_id, bus_id, driver_id, assignment_type, assigned_by, status)
               VALUES ($1, NULL, NULL, $2, $3, $4, 'active')\`,
              [plan.plan_id, driver_id, type, dispatcherId]
          );
      }

      await client.query('COMMIT');
      return success(res, null, 'Phân công tự động thành công (Thuật toán Công Bằng & Dự bị)!');
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
};
`;

const finalContent = content.substring(0, targetFunctionStart) + newFunction + "\nmodule.exports = assignmentController;";
fs.writeFileSync(filePath, finalContent);
console.log('Successfully rewrote autoAssignPlan logic.');
