require('dotenv').config();
const pool = require('../src/config/database');

async function test() {
  const planRes = await pool.query(`SELECT plan_id FROM operation_plans WHERE operation_date = '2026-07-04' LIMIT 1`);
  if (!planRes.rows.length) return process.exit(1);
  const planId = planRes.rows[0].plan_id;
  const grps = await pool.query(`SELECT group_name, start_time FROM trip_groups WHERE plan_id = $1 ORDER BY start_time ASC`, [planId]);
  
  // also simulate assignmentsToMake
  const assignmentsToMake = [];
  const earliest = grps.rows[0].start_time;
  for(let i=0; i<4; i++){
      const type = i < 2 ? 'standby_morning' : 'standby_afternoon';
      let st = new Date(earliest.getTime());
      if(type === 'standby_afternoon') st = new Date(st.getTime() + 9 * 60 * 60 * 1000);
      assignmentsToMake.push({ type, start_time: st });
  }
  for(const g of grps.rows) assignmentsToMake.push({ type: 'main', start_time: g.start_time, name: g.group_name });
  
  assignmentsToMake.sort((a,b) => a.start_time.getTime() - b.start_time.getTime());
  
  assignmentsToMake.forEach((a, i) => {
      console.log(`Index ${i}: ${a.type === 'main' ? a.name : a.type} at ${new Date(a.start_time).toISOString()}`);
  });
  process.exit(0);
}
test();
