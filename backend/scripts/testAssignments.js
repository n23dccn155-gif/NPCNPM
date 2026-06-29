require('dotenv').config();
const { Pool } = require('pg');
const pool = require('../src/config/database');

async function test() {
  const plan = { operation_date: '2026-07-04' };
  const baseDateStr = '2026-07-04';
  
  const assignmentsToMake = [];
  
  // mock some main shifts
  assignmentsToMake.push({ type: 'main', start_time: '2026-07-03T22:00:00Z' }); // 05:00
  assignmentsToMake.push({ type: 'main', start_time: '2026-07-03T22:05:00Z' }); // 05:05
  assignmentsToMake.push({ type: 'main', start_time: '2026-07-03T22:10:00Z' }); // 05:10
  
  for (let i = 0; i < 4; i++) {
      const type = i < 2 ? 'standby_morning' : 'standby_afternoon';
      const timeStr = type === 'standby_morning' ? '05:00:00Z' : '14:00:00Z';
      assignmentsToMake.push({
          type: type,
          start_time: new Date(`${baseDateStr}T${timeStr}`)
      });
  }
  
  assignmentsToMake.sort((a, b) => {
     const timeA = a.start_time instanceof Date ? a.start_time.getTime() : new Date(a.start_time).getTime();
     const timeB = b.start_time instanceof Date ? b.start_time.getTime() : new Date(b.start_time).getTime();
     return timeA - timeB;
  });
  
  console.log(assignmentsToMake);
  process.exit(0);
}
test();
