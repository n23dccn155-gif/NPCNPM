const pool = require('./src/config/database');
async function run() {
  try {
    await pool.query("UPDATE buses SET status = 'active' WHERE status = 'maintenance'");
    await pool.query("DELETE FROM incident_reports");
    console.log("Reset incidents and buses successfully!");
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
