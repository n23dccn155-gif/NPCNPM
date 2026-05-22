const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: String(process.env.DB_PASSWORD || ''),
  port: process.env.DB_PORT,
});

// Test the connection
pool.on('error', (err) => {
  console.error('Lỗi kết nối cơ sở dữ liệu:', err);
});

module.exports = pool;
