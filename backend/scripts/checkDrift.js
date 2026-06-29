require('dotenv').config();
const pool = require('../src/config/database');

async function test() {
  try {
    const res = await pool.query(`
      SELECT p.operation_date, a.assignment_type
      FROM operation_plans p
      LEFT JOIN assignments a ON p.plan_id = a.plan_id AND a.driver_id = 1
      WHERE p.route_code = '150'
      ORDER BY p.operation_date ASC
      LIMIT 30
    `);
    
    let workStreak = 0;
    for (const row of res.rows) {
      const date = row.operation_date.toISOString().split('T')[0];
      const dayOfWeek = row.operation_date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      if (row.assignment_type) {
        workStreak++;
        console.log(`[${date}] ${days[dayOfWeek]}: Work (${row.assignment_type}) - Streak: ${workStreak}`);
      } else {
        console.log(`[${date}] ${days[dayOfWeek]}: OFF - Rested after ${workStreak} days`);
        workStreak = 0;
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
test();
