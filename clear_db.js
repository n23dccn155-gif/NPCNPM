const pool = require('./backend/src/config/database');

async function clearSchedules() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Clearing assignments...');
    await client.query('DELETE FROM assignments;');
    console.log('Clearing trips...');
    await client.query('DELETE FROM trips;');
    console.log('Clearing trip_groups...');
    await client.query('DELETE FROM trip_groups;');
    console.log('Clearing incidents...');
    await client.query('DELETE FROM incident_reports;');
    console.log('Clearing operation_plans...');
    await client.query('DELETE FROM operation_plans;');
    await client.query('COMMIT');
    console.log('Successfully cleared all schedules.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error clearing schedules:', e);
  } finally {
    client.release();
    pool.end();
  }
}

clearSchedules();
