const fs = require('fs');
const path = 'src/controllers/assignmentController.js';
let data = fs.readFileSync(path, 'utf8');

const target = `      // Lọc các xe bị trùng lịch hoặc đã được phân công trong ngày này
      const availableBuses = [];
      for (let bus of busesRes.rows) {
        const overlap = await pool.query(
          \`SELECT tg.group_name 
           FROM assignments a
           JOIN trip_groups tg ON a.group_id = tg.group_id
           JOIN operation_plans p ON tg.plan_id = p.plan_id
           WHERE a.bus_id = $1 AND a.status = 'active' 
             AND p.operation_date = $2
             AND tg.group_id != $3\`,
          [bus.bus_id, group.operation_date, groupId]
        );
        if (overlap.rows.length === 0) {
          availableBuses.push(bus);
        }
      }

      // 2. Tài xế khả dụng: working, không xin nghỉ vào ngày vận hành này
      const driversRes = await pool.query(
        \`SELECT d.driver_id, d.full_name, d.phone, d.license_class
         FROM drivers d
         WHERE d.status = 'working'
           AND NOT EXISTS (
             SELECT 1 FROM leave_requests l 
             WHERE l.driver_id = d.driver_id 
               AND l.leave_date = $1 
               AND l.status = 'approved'
           )
         ORDER BY d.full_name\`,
        [group.operation_date]
      );

      // Lọc các tài xế bị trùng lịch hoặc đã được phân công trong ngày này
      const availableDrivers = [];
      for (let driver of driversRes.rows) {
        const overlap = await pool.query(
          \`SELECT tg.group_name 
           FROM assignments a
           JOIN trip_groups tg ON a.group_id = tg.group_id
           JOIN operation_plans p ON tg.plan_id = p.plan_id
           WHERE a.driver_id = $1 AND a.status = 'active' 
             AND p.operation_date = $2
             AND tg.group_id != $3\`,
          [driver.driver_id, group.operation_date, groupId]
        );
        if (overlap.rows.length === 0) {
          availableDrivers.push(driver);
        }
      }`;

const replacement = `      const d = new Date(group.start_time);
      const groupDateStr = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;

      // Lọc các xe bị trùng lịch hoặc đã được phân công trong ngày này (trùng ngày, không phải trùng cả kế hoạch 7 ngày)
      const availableBuses = [];
      for (let bus of busesRes.rows) {
        const overlap = await pool.query(
          \`SELECT tg.group_name 
           FROM assignments a
           JOIN trip_groups tg ON a.group_id = tg.group_id
           WHERE a.bus_id = $1 AND a.status = 'active' 
             AND DATE(tg.start_time) = $2
             AND tg.group_id != $3\`,
          [bus.bus_id, groupDateStr, groupId]
        );
        if (overlap.rows.length === 0) {
          availableBuses.push(bus);
        }
      }

      // 2. Tài xế khả dụng: working, thuộc tuyến, không xin nghỉ vào ngày vận hành này
      const driversRes = await pool.query(
        \`SELECT d.driver_id, d.full_name, d.phone, d.license_class, rd.driver_role
         FROM drivers d
         JOIN route_drivers rd ON d.driver_id = rd.driver_id
         WHERE rd.route_code = $1 AND rd.status = 'active' AND d.status = 'working'
           AND NOT EXISTS (
             SELECT 1 FROM leave_requests l 
             WHERE l.driver_id = d.driver_id 
               AND l.leave_date = $2 
               AND l.status = 'approved'
           )
         ORDER BY rd.driver_role DESC, d.full_name\`,
        [group.route_code, groupDateStr]
      );

      // Lọc các tài xế bị trùng lịch hoặc đã được phân công trong ngày này
      const availableDrivers = [];
      for (let driver of driversRes.rows) {
        const overlap = await pool.query(
          \`SELECT tg.group_name 
           FROM assignments a
           JOIN trip_groups tg ON a.group_id = tg.group_id
           WHERE a.driver_id = $1 AND a.status = 'active' 
             AND DATE(tg.start_time) = $2
             AND tg.group_id != $3\`,
          [driver.driver_id, groupDateStr, groupId]
        );
        if (overlap.rows.length === 0) {
          availableDrivers.push(driver);
        }
      }`;

if (data.includes(target)) {
    data = data.replace(target, replacement);
    fs.writeFileSync(path, data);
    console.log('Success');
} else {
    console.log('Target content not found.');
}
