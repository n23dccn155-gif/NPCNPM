require('dotenv').config();
const pool = require('../src/config/database');

async function fix() {
  try {
    const buses = await pool.query("SELECT bus_id FROM buses WHERE status = 'active' LIMIT 12");
    for (const b of buses.rows) {
      await pool.query(
        "INSERT INTO route_buses (route_code, bus_id, bus_role) VALUES ($1, $2, 'operating') ON CONFLICT DO NOTHING",
        ['150', b.bus_id]
      );
    }
    console.log('Added 12 operating buses to route 150');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
fix();
