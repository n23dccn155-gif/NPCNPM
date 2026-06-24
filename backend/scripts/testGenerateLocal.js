require('dotenv').config();
const { generate2Months } = require('../src/controllers/batchController');

async function test() {
  try {
    const req = { params: { routeCode: '150' }, user: { id: 1 } };
    const res = {
      status: (c) => ({
        json: (d) => { console.log('STATUS', c, d); }
      }),
      json: (d) => { console.log('JSON', d); },
      send: (d) => { console.log('SEND', d); }
    };
    const next = (err) => { console.error('NEXT ERROR:', err); };
    
    await generate2Months(req, res, next);
  } catch (err) {
    console.error('CATCH:', err);
  }
}
test();
