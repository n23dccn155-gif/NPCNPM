require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function run() {
  try {
    const routes = await pool.query("SELECT route_code FROM routes");
    for (const route of routes.rows) {
        const routeCode = route.route_code;
        const drivers = await pool.query("SELECT driver_code FROM drivers WHERE route_code = $1 AND status = 'active' ORDER BY driver_code", [routeCode]);
        
        let slot = 0;
        for (const d of drivers.rows) {
            await pool.query("UPDATE drivers SET base_slot = $1 WHERE driver_code = $2", [slot, d.driver_code]);
            slot++;
        }
    }
    console.log("Fixed base_slots successfully!");
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
