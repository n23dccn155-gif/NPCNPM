const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'bus_trip_db',
  user: 'postgres',
  password: '123456',
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('--- Starting Migration: Add scheduling params to routes ---');
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE routes
      ADD COLUMN IF NOT EXISTS travel_time_minutes INT DEFAULT 80,
      ADD COLUMN IF NOT EXISTS short_layover_minutes INT DEFAULT 10,
      ADD COLUMN IF NOT EXISTS long_layover_minutes INT DEFAULT 15,
      ADD COLUMN IF NOT EXISTS max_driving_minutes INT DEFAULT 240,
      ADD COLUMN IF NOT EXISTS standby_ratio DECIMAL(4,2) DEFAULT 0.15;
    `);

    console.log('Added new columns to routes table.');

    await client.query('COMMIT');
    console.log('--- Migration Completed Successfully ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during migration:', err);
  } finally {
    client.release();
    pool.end();
  }
}

main();
