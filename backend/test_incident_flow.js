const pool = require('./src/config/database');
const inc = require('./src/controllers/incidentController');

async function test() {
  try {
    const res = {
      status: (code) => { console.log('status', code); return res; },
      json: (data) => { console.log('json', data); }
    };
    const req = {
      user: { id: 6, role: 'driver' }, // User ID 6 corresponds to driver 6? Let's check. Wait, in earlier log, reported_by was 6. reported_by is driver_id! So driver_id=6. Let's just mock the req.user.role='driver' and we need the correct user_id. Let's just use user_id = 6 and hope it works. Or I can just set req.user.role = 'dispatcher' and pass driver_id = 6 in body!
      body: {
        plan_id: 783,
        bus_id: 19,
        trip_id: 218532,
        driver_id: 6,
        incident_type: 'bus_broken',
        description: 'test flow'
      }
    };
    // Let's set role to dispatcher to bypass user lookup
    req.user.role = 'dispatcher';
    
    await inc.create(req, res);
    setTimeout(() => pool.end(), 2000);
  } catch(e) {
    console.error(e);
    pool.end();
  }
}
test();
