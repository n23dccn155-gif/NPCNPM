require('dotenv').config();
const pool = require('../src/config/database');

async function test() {
  const dates = ['2026-06-24', '2026-07-01']; // Day 1 and Day 8
  for (const d of dates) {
    const res = await pool.query(`SELECT (extract(epoch FROM $1::date)/86400/7)::int AS cycle`, [d]);
    console.log(`${d}: cycle = ${res.rows[0].cycle}`);
  }
  process.exit(0);
}
test();
