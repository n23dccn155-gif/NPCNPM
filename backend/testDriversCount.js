const pool = require('./src/config/database');
pool.query("SELECT COUNT(*) as cnt FROM route_drivers WHERE status='active' AND route_code='150'")
  .then(res => { console.log("Drivers:", res.rows[0].cnt); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
