require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function run() {
  try {
    // 10 drivers
    const hashed = await bcrypt.hash('123456', 10);
    // Role 4 is usually driver
    for (let i = 1; i <= 10; i++) {
        // user
        const username = 'driver_new_' + i;
        const resUser = await pool.query(
            "INSERT INTO users (username, password, role_id, full_name, status) VALUES ($1, $2, $3, $4, 'active') RETURNING id",
            [username, hashed, 4, 'Tài xế bổ sung ' + i]
        );
        const userId = resUser.rows[0].id;
        
        // driver
        const route_code = i <= 5 ? '01' : '08';
        const driver_code = 'DR' + String(100 + i);
        await pool.query(
            "INSERT INTO drivers (driver_code, full_name, user_id, route_code, status, base_slot) VALUES ($1, $2, $3, $4, 'active', $5)",
            [driver_code, 'Tài xế bổ sung ' + i, userId, route_code, i]
        );
    }
    console.log("Added 10 drivers successfully!");
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
