const { Pool } = require('pg');
require('dotenv').config();

// Ưu tiên DATABASE_URL (Neon, Supabase, Heroku, ...) - đã có sẵn SSL options trong URL.
// Fallback về DB_HOST/DB_USER/... cho Postgres local.
const useDatabaseUrl = !!process.env.DATABASE_URL;

const pool = new Pool(
  useDatabaseUrl
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Neon / cloud Postgres yêu cầu SSL
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: String(process.env.DB_PASSWORD || ''),
        port: process.env.DB_PORT
      }
);

// Log chế độ kết nối (không lộ password)
console.log(
  '[DB] Connecting to:',
  useDatabaseUrl
    ? `Neon via DATABASE_URL (${process.env.DATABASE_URL.split('@').pop().split('/')[0]}/${process.env.DATABASE_URL.split('/').pop().split('?')[0]})`
    : `${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
);

pool.on('error', (err) => {
  console.error('Lỗi kết nối cơ sở dữ liệu:', err.message);
});

// Test connection ngay khi khởi động (fail fast)
pool
  .query('SELECT NOW() as now, current_database() as db')
  .then((res) => {
    console.log(`[DB] Connected OK at ${res.rows[0].now} (db="${res.rows[0].db}")`);
  })
  .catch((err) => {
    console.error('[DB] Connection test FAILED:', err.message);
    console.error('[DB] Kiểm tra lại DATABASE_URL / thông tin đăng nhập.');
  });

module.exports = pool;