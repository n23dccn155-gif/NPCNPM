const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function seed() {
  try {
    const passwordHash = '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry'; // 123456

    console.log('Inserting 50 buses...');
    for (let i = 1; i <= 50; i++) {
      const busId = `51B-500.${String(i).padStart(2, '0')}`;
      await pool.query(
        'INSERT INTO buses (bus_id, license_plate, capacity, status) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [busId, busId, 45, 'active']
      );
    }

    console.log('Inserting 50 drivers...');
    for (let i = 1; i <= 50; i++) {
      const username = `driver50_${i}`;
      const fullName = `Tài xế tự động ${i}`;
      const driverCode = `TX500${String(i).padStart(2, '0')}`;
      
      const userRes = await pool.query(
        'INSERT INTO users (username, password, full_name, phone, role_id, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [username, passwordHash, fullName, `090500${String(i).padStart(4, '0')}`, 4, 'active']
      );
      
      const userId = userRes.rows[0].id;
      
      await pool.query(
        'INSERT INTO drivers (driver_code, full_name, user_id, license_type, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
        [driverCode, fullName, userId, 'E', 'active']
      );
    }
    console.log('Done!');
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

seed();
