const pool = require('./src/config/database');
const assignmentController = require('./src/controllers/assignmentController');

async function test() {
  const client = await pool.connect();
  try {
    await client.query("UPDATE buses SET status = 'maintenance' WHERE bus_id = 2");
    
    // Create a dummy group and assignment with NULL bus_id
    const newGroupRes = await client.query(
        `INSERT INTO trip_groups (plan_id, group_name, start_time, end_time, status) VALUES (783, 'Test Tách', '2026-06-24T14:10:00.000Z', '2026-06-24T15:30:00.000Z', 'unassigned') RETURNING group_id`
    );
    const newGroupId = newGroupRes.rows[0].group_id;
    
    await client.query(
        `INSERT INTO assignments (plan_id, group_id, bus_id, driver_id, assignment_type, assigned_by, status) VALUES (783, $1, NULL, NULL, 'main', 1, 'active')`,
        [newGroupId]
    );

    await assignmentController.autoReallocateBuses('150', 2);
    
    const checkRes = await client.query("SELECT bus_id FROM assignments WHERE group_id = $1", [newGroupId]);
    console.log('Assigned bus_id:', checkRes.rows[0].bus_id);

    // cleanup
    await client.query("DELETE FROM assignments WHERE group_id = $1", [newGroupId]);
    await client.query("DELETE FROM trip_groups WHERE group_id = $1", [newGroupId]);
  } finally {
    client.release();
    pool.end();
  }
}
test();
