const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  password: '123456',
  host: 'localhost',
  port: 5432,
  database: 'bus_trip_db'
});

async function run() {
  try {
    await pool.query(`
      INSERT INTO route_directions (route_code, direction_type, start_point, end_point, distance_km, travel_time_minutes, turnaround_time_minutes)
      VALUES ('150', 'inbound', 'Bến B', 'Bến A', 35.00, 80, 10)
      ON CONFLICT (route_code, direction_type) DO NOTHING
    `);
    console.log('Done');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
