const pool = require('./src/config/database');
const assignmentController = require('./src/controllers/assignmentController');

async function test() {
  const client = await pool.connect();
  try {
    const tripsRes = await client.query("SELECT t.trip_id, t.group_id, a.bus_id, tg.plan_id FROM trips t JOIN trip_groups tg ON t.group_id = tg.group_id JOIN assignments a ON a.group_id = tg.group_id WHERE t.status = 'assigned' AND a.status = 'active' AND a.driver_id IS NOT NULL AND a.bus_id IS NOT NULL LIMIT 1");
    if (!tripsRes.rows.length) { console.log('No valid trips'); return; }
    const trip = tripsRes.rows[0];
    const bus_id = trip.bus_id;
    console.log('Testing with bus_id:', bus_id);

    await client.query("UPDATE buses SET status = 'maintenance' WHERE bus_id = $1", [bus_id]);

    const routeCode = '150';
    try {
      await assignmentController.autoReallocateBuses(routeCode, bus_id);
      console.log('Reallocation success');
    } catch (e) {
      console.log('Reallocation error:', e);
    }
  } finally {
    client.release();
    pool.end();
  }
}
test();
