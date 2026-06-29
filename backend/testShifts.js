const pool = require('./src/config/database');
pool.query("SELECT * FROM operation_plans WHERE route_code='150' ORDER BY operation_date DESC LIMIT 1").then(res => { 
  console.log('Plan:', res.rows[0]); 
  return pool.query("SELECT COUNT(*) as count FROM assignments WHERE plan_id=$1", [res.rows[0].plan_id]); 
}).then(res => { 
  console.log('Shifts:', res.rows[0].count); 
  process.exit(0); 
}).catch(err => {
  console.error(err);
  process.exit(1);
});
