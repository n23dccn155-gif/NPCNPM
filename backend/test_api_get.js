const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const pool = require('./src/config/database');

async function test() {
    try {
        const planId = 783;
        const res = await pool.query(
            `SELECT p.*, r.route_name, u.full_name AS creator_name
             FROM operation_plans p
             JOIN routes r ON p.route_code = r.route_code
             JOIN users u ON p.created_by = u.user_id
             WHERE p.plan_id = $1`,
            [planId]
        );
        console.log("Plan found:", res.rows.length);
        if (res.rows.length === 0) return;
        
        const tripsRes = await pool.query(
            `SELECT t.*, tg.group_name, rd.direction_type, rd.start_point, rd.end_point
             FROM trips t
             LEFT JOIN trip_groups tg ON t.group_id = tg.group_id
             JOIN route_directions rd ON t.direction_id = rd.direction_id
             WHERE t.plan_id = $1
             ORDER BY t.trip_order`,
            [planId]
        );
        console.log("Trips found:", tripsRes.rows.length);
    } catch(e) { console.error(e); } finally { pool.end(); }
}
test();
