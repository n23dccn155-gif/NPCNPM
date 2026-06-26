const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const pool = require('./src/config/database');

async function test() {
    try {
        const query = "SELECT plan_id, operation_date, status FROM operation_plans WHERE route_code = '150' AND operation_date = '2026-06-24'";
        const res = await pool.query(query);
        console.log(res.rows);
    } catch(e) { console.error(e); } finally { pool.end(); }
}
test();
