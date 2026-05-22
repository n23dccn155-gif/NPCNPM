const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runSqlFile(filePath) {
  const absolutePath = path.resolve(__dirname, filePath);
  if (!fs.existsSync(absolutePath)) {
    console.log(`[Bỏ qua] Không tìm thấy file: ${filePath}`);
    return;
  }
  const sql = fs.readFileSync(absolutePath, 'utf8');
  console.log(`Đang chạy file: ${filePath}...`);
  try {
    await pool.query(sql);
    console.log(`[Thành công] ${filePath}`);
  } catch (error) {
    console.error(`[Lỗi] khi chạy ${filePath}:`, error.message);
  }
}

async function initDb() {
  console.log('Bắt đầu khởi tạo Cơ sở dữ liệu...');
  
  // Đường dẫn đến các file SQL
  const sqlFiles = [
    '../../../database/schema.sql',
    '../../../database/constraints.sql',
    '../../../database/indexes.sql',
    '../../../database/seed.sql'
  ];

  for (const file of sqlFiles) {
    await runSqlFile(file);
  }

  console.log('Hoàn tất khởi tạo CSDL.');
  process.exit(0);
}

initDb();
