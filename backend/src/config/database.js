const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Neon requires SSL
    }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: String(process.env.DB_PASSWORD || ''),
      port: process.env.DB_PORT,
    };

const pool = new Pool(poolConfig);

// Test the connection
pool.on('error', (err) => {
  console.error('Lỗi kết nối cơ sở dữ liệu:', err);
});

module.exports = pool;
