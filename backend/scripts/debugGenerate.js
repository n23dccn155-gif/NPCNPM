require('dotenv').config();
const { generateSchedule } = require('../src/controllers/planController');
const pool = require('../src/config/database');

async function test() {
  try {
    const req = { params: { id: '150' }, user: { id: 1 } };
    const res = {
      status: (c) => ({
        json: (d) => { console.log('STATUS', c, d); }
      }),
      json: (d) => { console.log('JSON', d); }
    };
    const next = (err) => { console.error('NEXT ERROR:', err); };
    
    await generateSchedule(req, res, next);
  } catch (err) {
    console.error('CATCH:', err);
  } finally {
    process.exit(0);
  }
}
test();
