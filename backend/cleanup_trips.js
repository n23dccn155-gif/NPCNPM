const pool = require('./src/config/database');

async function cleanup() {
  try {
    // 1. Delete all trips and assignments
    await pool.query('DELETE FROM trip_assignments;');
    await pool.query('DELETE FROM trips;');
    
    // 2. Disable old drivers to prevent overlaps
    await pool.query("UPDATE drivers SET status = 'inactive' WHERE driver_code IN ('TX001', 'TX002', 'TX003')");
    
    console.log("Cleanup successful");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

cleanup();
