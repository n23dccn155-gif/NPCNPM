const pool = require('./src/config/database');

async function getDrivers() {
  try {
    const res = await pool.query("SELECT u.username, d.driver_code FROM users u JOIN drivers d ON u.id = d.user_id LIMIT 5");
    console.log(res.rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

getDrivers();
