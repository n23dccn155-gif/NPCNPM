require('dotenv').config();
const pool = require('../src/config/database');

async function test() {
  try {
    const driverRes = await pool.query("SELECT driver_id FROM drivers WHERE user_id = 3");
    if (driverRes.rows.length === 0) {
      console.log('Driver not found for user_id 3');
      process.exit(1);
    }
    const driverId = driverRes.rows[0].driver_id;
    
    const scheduleRes = await pool.query(`
      SELECT 
        p.operation_date, 
        a.assignment_type,
        tg.group_name,
        tg.start_time,
        tg.end_time
      FROM assignments a
      JOIN operation_plans p ON a.plan_id = p.plan_id
      LEFT JOIN trip_groups tg ON a.group_id = tg.group_id
      WHERE a.driver_id = $1 AND p.route_code = '150'
      ORDER BY p.operation_date ASC
      LIMIT 14
    `, [driverId]);
    
    console.log(`Schedule for driver_id ${driverId} (next 14 days):`);
    console.table(scheduleRes.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
test();
