const pool = require('./src/config/database');
async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const splitGroups = await client.query("SELECT * FROM trip_groups WHERE group_name LIKE '% (Tách)'");
    for (const sg of splitGroups.rows) {
      const origName = sg.group_name.replace(' (Tách)', '');
      const origGroupRes = await client.query("SELECT * FROM trip_groups WHERE plan_id = $1 AND group_name = $2", [sg.plan_id, origName]);
      if (origGroupRes.rows.length) {
        const origGroupId = origGroupRes.rows[0].group_id;
        await client.query("UPDATE trips SET group_id = $1 WHERE group_id = $2", [origGroupId, sg.group_id]);
        await client.query("DELETE FROM assignments WHERE group_id = $1", [sg.group_id]);
        await client.query("DELETE FROM trip_groups WHERE group_id = $1", [sg.group_id]);
        const maxTimeRes = await client.query("SELECT MAX(scheduled_arrival) as max_arr FROM trips WHERE group_id = $1", [origGroupId]);
        if (maxTimeRes.rows[0].max_arr) {
          await client.query("UPDATE trip_groups SET end_time = $1 WHERE group_id = $2", [maxTimeRes.rows[0].max_arr, origGroupId]);
        }
      }
    }
    await client.query("UPDATE trips SET status = 'scheduled' WHERE status = 'cancelled'");
    await client.query("UPDATE trips SET status = 'assigned' WHERE group_id IN (SELECT group_id FROM assignments WHERE status = 'active')");
    await client.query('COMMIT');
    console.log('Reset complete');
  } catch(e) {
    await client.query('ROLLBACK');
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
