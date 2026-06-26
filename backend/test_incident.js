const pool = require('./src/config/database');
const incidentController = require('./src/controllers/incidentController');
const assignmentController = require('./src/controllers/assignmentController');

async function test() {
  const client = await pool.connect();
  try {
    // 1. Get a random running trip
    const tripsRes = await client.query(
      SELECT t.trip_id, t.group_id, a.bus_id, tg.plan_id 
      FROM trips t 
      JOIN trip_groups tg ON t.group_id = tg.group_id
      JOIN assignments a ON a.group_id = tg.group_id
      WHERE t.status = 'assigned' AND a.status = 'active' AND a.driver_id IS NOT NULL AND a.bus_id IS NOT NULL
      LIMIT 1
    );
    if (!tripsRes.rows.length) { console.log('No valid trips'); return; }
    const trip = tripsRes.rows[0];
    console.log('Testing with trip:', trip.trip_id, 'bus:', trip.bus_id);

    // Call incidentController logic manually
    const req = {
      body: {
        bus_id: trip.bus_id,
        trip_id: trip.trip_id,
        incident_type: 'bus_broken',
        description: 'Test broken bus'
      },
      user: { id: 1 } // dispatcher or driver
    };
    
    // We will simulate the same DB ops
    await client.query('BEGIN');
    const bus_id = req.body.bus_id;
    const trip_id = req.body.trip_id;
    
    await client.query(UPDATE buses SET status = 'maintenance' WHERE bus_id = , [bus_id]);
    
    const tripGroupRes = await client.query(SELECT * FROM trips WHERE trip_id = , [trip_id]);
    const brokenTrip = tripGroupRes.rows[0];
    const groupId = brokenTrip.group_id;
    
    const oldGroupRes = await client.query(SELECT * FROM trip_groups WHERE group_id = , [groupId]);
    const oldGroup = oldGroupRes.rows[0];
    
    const remainingTripsRes = await client.query(
      SELECT trip_id, scheduled_departure, scheduled_arrival FROM trips WHERE group_id =  AND scheduled_departure >  ORDER BY scheduled_departure ASC,
      [groupId, brokenTrip.scheduled_departure]
    );
    
    if (remainingTripsRes.rows.length > 0) {
      const firstRemaining = remainingTripsRes.rows[0];
      const lastRemaining = remainingTripsRes.rows[remainingTripsRes.rows.length - 1];
      const newGroupRes = await client.query(
        INSERT INTO trip_groups (plan_id, group_name, start_time, end_time, status) VALUES (, , , , 'unassigned') RETURNING group_id,
        [oldGroup.plan_id, oldGroup.group_name + ' (Tách)', firstRemaining.scheduled_departure, lastRemaining.scheduled_arrival]
      );
      const newGroupId = newGroupRes.rows[0].group_id;
      const remainingTripIds = remainingTripsRes.rows.map(t => t.trip_id);
      await client.query(UPDATE trips SET group_id =  WHERE trip_id = ANY(::int[]), [newGroupId, remainingTripIds]);
      await client.query(UPDATE trips SET status = 'cancelled' WHERE trip_id = , [trip_id]);
      
      const oldAssignRes = await client.query(SELECT * FROM assignments WHERE group_id =  AND status = 'active', [groupId]);
      const oldAssign = oldAssignRes.rows[0];
      await client.query(
        INSERT INTO assignments (plan_id, group_id, bus_id, driver_id, assignment_type, assigned_by, status) VALUES (, , NULL, NULL, , , 'active') RETURNING assignment_id,
        [oldAssign.plan_id, newGroupId, oldAssign.assignment_type, oldAssign.assigned_by]
      );
    }
    
    await client.query('COMMIT');
    console.log('Split done. Now running autoReallocateBuses...');
    
    const rbRes = await client.query(SELECT route_code FROM route_buses WHERE bus_id = , [bus_id]);
    const routeCode = rbRes.rows[0].route_code;
    await assignmentController.autoReallocateBuses(routeCode, bus_id);
    console.log('Reallocation done');
    
  } catch(e) {
    await client.query('ROLLBACK');
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
test();
