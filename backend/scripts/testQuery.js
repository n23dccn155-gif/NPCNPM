require('dotenv').config();
const pool = require('../src/config/database');

async function test() {
  const res = await pool.query(`
        SELECT d.driver_id,
                COALESCE(
                  (SELECT ('2026-07-04'::date - dDate::date) - 1
                   FROM generate_series('2026-07-04'::date - INTERVAL '30 days', '2026-07-04'::date - INTERVAL '1 day', '1 day') AS dDate
                   WHERE NOT EXISTS (
                     SELECT 1 FROM assignments a 
                     JOIN operation_plans p ON a.plan_id = p.plan_id
                     WHERE a.driver_id = rd.driver_id AND p.operation_date = dDate::date AND a.status = 'active'
                   )
                   ORDER BY dDate DESC LIMIT 1), 
                  30
                ) AS consecutive_shifts
         FROM route_drivers rd
         JOIN drivers d ON rd.driver_id = d.driver_id
         WHERE rd.route_code = '150'
           AND rd.status = 'active'
           AND d.status = 'working'
         ORDER BY consecutive_shifts ASC, md5(rd.driver_id::text || '2026-07-04') ASC
  `);
  
  const d1 = res.rows.find(r => r.driver_id === 1);
  console.log('Driver 1:', d1);
  console.log('Total drivers:', res.rows.length);
  console.log('Index of Driver 1:', res.rows.findIndex(r => r.driver_id === 1));
  console.log('Top 5:', res.rows.slice(0, 5));
  console.log('Bottom 5:', res.rows.slice(-5));
  process.exit(0);
}
test();
