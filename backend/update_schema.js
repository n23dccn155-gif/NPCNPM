const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function run() {
  try {
    console.log('Altering drivers table...');
    await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS route_code VARCHAR(20);`);
    await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS base_slot INTEGER DEFAULT 0;`);
    
    // Check if constraint exists before adding (to make script idempotent)
    const constraintCheck = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'drivers' AND constraint_name = 'fk_drivers_routes'
    `);
    if (constraintCheck.rows.length === 0) {
      await pool.query(`ALTER TABLE drivers ADD CONSTRAINT fk_drivers_routes FOREIGN KEY (route_code) REFERENCES routes(route_code);`);
    }

    console.log('Updating existing drivers...');
    // update old ones
    await pool.query(`UPDATE drivers SET route_code = '01', base_slot = 0 WHERE driver_code = 'TX001';`);
    await pool.query(`UPDATE drivers SET route_code = '01', base_slot = 13 WHERE driver_code = 'TX002';`);
    await pool.query(`UPDATE drivers SET route_code = '08', base_slot = 0 WHERE driver_code = 'TX003';`);
    
    // update the 50 new drivers
    // Assign 26 to route '01' with slot 0 to 25
    for(let i=1; i<=26; i++) {
       const code = `TX500${String(i).padStart(2, '0')}`;
       await pool.query(`UPDATE drivers SET route_code = '01', base_slot = $1 WHERE driver_code = $2`, [i-1, code]);
    }
    // Assign the rest to route '08' with slot 0 to 23
    for(let i=27; i<=50; i++) {
       const code = `TX500${String(i).padStart(2, '0')}`;
       await pool.query(`UPDATE drivers SET route_code = '08', base_slot = $1 WHERE driver_code = $2`, [i-27, code]);
    }
    
    console.log('Schema update complete!');
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
