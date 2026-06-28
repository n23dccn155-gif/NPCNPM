const pool = require('./src/config/database');
const queries = [
  "SELECT extract(epoch FROM '2026-08-01'::date)/86400 AS e1",
  "SELECT (extract(epoch FROM '2026-08-01'::date)/86400)::int AS e1_int",
  "SELECT extract(epoch FROM '2026-08-02'::date)/86400 AS e2",
  "SELECT (extract(epoch FROM '2026-08-02'::date)/86400)::int AS e2_int",
  "SELECT extract(epoch FROM '2026-08-03'::date)/86400 AS e3",
  "SELECT (extract(epoch FROM '2026-08-03'::date)/86400)::int AS e3_int",
  "SELECT extract(epoch FROM '2026-08-04'::date)/86400 AS e4",
  "SELECT (extract(epoch FROM '2026-08-04'::date)/86400)::int AS e4_int",
];
(async () => {
  for(let q of queries) {
    const res = await pool.query(q);
    console.log(q, '=>', res.rows[0]);
  }
  process.exit(0);
})();
