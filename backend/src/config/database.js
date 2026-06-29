const { Pool } = require('pg');
require('dotenv').config();

const config = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: String(process.env.DB_PASSWORD || ''),
      port: process.env.DB_PORT,
    };

const pool = new Pool(config);

// Test the connection
pool.on('error', (err) => {
  console.error('Lỗi kết nối cơ sở dữ liệu:', err);
});

module.exports = pool;
