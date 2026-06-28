const fs = require('fs');
const file = 'src/controllers/assignmentController.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /getAvailableResources: async \(req, res, next\) => \{([\s\S]*?)return success\(res, \{ buses: availableBuses, drivers: availableDrivers \}\);\n    \} catch \(err\) \{ next\(err\); \}\n  \},/g;

const replacement = `getAvailableResources: async (req, res, next) => {
    try {
      const { groupId } = req.params;

      const groupRes = await pool.query(
        'SELECT g.*, p.operation_date, p.route_code FROM trip_groups g JOIN operation_plans p ON g.plan_id = p.plan_id WHERE g.group_id = $1',
        [groupId]
      );
      if (!groupRes.rows.length) {
        return error(res, 'Không tìm thấy nhóm chuyến', 404);
      }
      const group = groupRes.rows[0];

      const { is_replacement } = req.query;
      const isReplacement = is_replacement === 'true';

      let busQuery = 'SELECT b.bus_id, b.license_plate, b.seat_count, rb.bus_role FROM buses b JOIN route_buses rb ON b.bus_id = rb.bus_id WHERE rb.route_code = $1 AND b.status = \\'active\\'';
      if (!isReplacement) {
        busQuery += ' AND rb.bus_role = \\'operating\\' ORDER BY b.license_plate';
      } else {
        busQuery += ' ORDER BY rb.bus_role DESC, b.license_plate'; 
      }

      const busesRes = await pool.query(busQuery, [group.route_code]);

      const d = new Date(group.start_time);
      const groupDateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

      const availableBuses = [];
      for (let bus of busesRes.rows) {
        const overlap = await pool.query(
          'SELECT tg.group_name FROM assignments a JOIN trip_groups tg ON a.group_id = tg.group_id WHERE a.bus_id = $1 AND a.status = \\'active\\' AND DATE(tg.start_time) = $2 AND tg.group_id != $3',
          [bus.bus_id, groupDateStr, groupId]
        );
        if (overlap.rows.length === 0) {
          availableBuses.push(bus);
        }
      }

      const driversRes = await pool.query(
        'SELECT d.driver_id, d.full_name, d.phone, d.license_class, rd.driver_role FROM drivers d JOIN route_drivers rd ON d.driver_id = rd.driver_id WHERE rd.route_code = $1 AND rd.status = \\'active\\' AND d.status = \\'working\\' AND NOT EXISTS (SELECT 1 FROM leave_requests l WHERE l.driver_id = d.driver_id AND l.leave_date = $2 AND l.status = \\'approved\\') ORDER BY rd.driver_role DESC, d.full_name',
        [group.route_code, groupDateStr]
      );

      const availableDrivers = [];
      for (let driver of driversRes.rows) {
        const overlap = await pool.query(
          'SELECT tg.group_name FROM assignments a JOIN trip_groups tg ON a.group_id = tg.group_id WHERE a.driver_id = $1 AND a.status = \\'active\\' AND DATE(tg.start_time) = $2 AND tg.group_id != $3',
          [driver.driver_id, groupDateStr, groupId]
        );
        if (overlap.rows.length === 0) {
          availableDrivers.push(driver);
        }
      }

      return success(res, { buses: availableBuses, drivers: availableDrivers });
    } catch (err) { next(err); }
  },`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content);
    console.log('Successfully replaced getAvailableResources via regex');
} else {
    console.log('Regex match failed');
}
