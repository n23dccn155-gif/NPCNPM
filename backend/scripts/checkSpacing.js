require('dotenv').config();
const pool = require('../src/config/database');

async function test() {
  try {
    const res = await pool.query(`
      SELECT p.operation_date, a.driver_id
      FROM operation_plans p
      LEFT JOIN assignments a ON p.plan_id = a.plan_id AND a.driver_id = 1
      WHERE p.route_code = '150'
      ORDER BY p.operation_date ASC
    `);
    
    let daysWorked = 0;
    for (const row of res.rows) {
      if (row.driver_id) {
        daysWorked++;
      } else {
        console.log(`Day off on ${row.operation_date.toISOString().split('T')[0]}, worked ${daysWorked} consecutive days prior.`);
        daysWorked = 0;
      }
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
test();
