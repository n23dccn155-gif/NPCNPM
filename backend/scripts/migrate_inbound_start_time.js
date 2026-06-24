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
    console.log('--- Starting Migration: Add inbound_start_time to routes ---');
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE routes
      ADD COLUMN IF NOT EXISTS inbound_start_time TIME DEFAULT '05:30:00';
    `);

    console.log('Added inbound_start_time to routes table.');

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
