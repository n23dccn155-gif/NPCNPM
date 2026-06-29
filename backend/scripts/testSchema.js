require('dotenv').config();
const pool = require('../src/config/database');

async function test() {
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'operation_plans'
  `);
  console.log(res.rows);
  process.exit(0);
}
test();
