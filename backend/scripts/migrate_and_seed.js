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
    console.log('--- Starting Migration & Seeding ---');
    await client.query('BEGIN');

    // 1. Create route_drivers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS route_drivers (
        route_driver_id SERIAL PRIMARY KEY,
        route_code VARCHAR(20) NOT NULL,
        driver_id INT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active'
      )
    `);
    console.log('Created route_drivers table');

    // 2. Modify assignments table
    await client.query('TRUNCATE TABLE assignments CASCADE');
    await client.query(`
      ALTER TABLE assignments 
      ADD COLUMN IF NOT EXISTS plan_id INT,
      ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(20) NOT NULL DEFAULT 'main';
    `);
    
    await client.query(`
      ALTER TABLE assignments ALTER COLUMN group_id DROP NOT NULL;
      ALTER TABLE assignments ALTER COLUMN bus_id DROP NOT NULL;
    `);
    console.log('Modified assignments table');

    // 3. Seed 30 Drivers
    const targetRoute = 'T01'; 
    let driversAdded = 0;

    for (let i = 1; i <= 30; i++) {
      const username = `driver_${i}`;
      const existUser = await client.query('SELECT user_id FROM users WHERE username = $1', [username]);
      if (existUser.rows.length > 0) continue;

      const userRes = await client.query(`
        INSERT INTO users (username, password_hash, full_name, role, status)
        VALUES ($1, $2, $3, 'driver', 'active')
        RETURNING user_id
      `, [username, 'hashed_password_placeholder', `Tài xế ${i}`]);
      const userId = userRes.rows[0].user_id;

      const driverRes = await client.query(`
        INSERT INTO drivers (user_id, full_name, phone, license_class, status)
        VALUES ($1, $2, $3, 'D', 'working')
        RETURNING driver_id
      `, [userId, `Tài xế ${i}`, `09000000${i.toString().padStart(2, '0')}`]);
      const driverId = driverRes.rows[0].driver_id;

      await client.query(`
        INSERT INTO route_drivers (route_code, driver_id, status)
        VALUES ($1, $2, 'active')
      `, [targetRoute, driverId]);

      driversAdded++;
    }
    
    console.log(`Seeded ${driversAdded} new drivers and assigned to route ${targetRoute}`);

    await client.query('COMMIT');
    console.log('--- Migration & Seeding Completed Successfully ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during migration/seeding:', err);
  } finally {
    client.release();
    pool.end();
  }
}

main();
