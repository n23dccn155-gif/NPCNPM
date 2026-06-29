const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../src/config/database');

async function clearAssignments() {
  try {
    console.log('Đang kết nối tới cơ sở dữ liệu để xóa dữ liệu phân công...');

    // Thực hiện TRUNCATE xóa sạch dữ liệu và reset lại ID tự tăng (SERIAL) về 1
    await pool.query('TRUNCATE TABLE assignments, trips, trip_groups, operation_plans RESTART IDENTITY CASCADE;');

    console.log(' Xóa sạch dữ liệu phân công thành công! Hệ thống hiện tại sạch sẽ như chưa từng lập kế hoạch.');
  } catch (error) {
    console.error(' Có lỗi xảy ra khi xóa dữ liệu:', error);
  } finally {
    await pool.end();
  }
}

clearAssignments();
