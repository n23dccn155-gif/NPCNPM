require('dotenv').config();
const pool = require('../src/config/database');

async function getUsers() {
  try {
    const dispatchers = await pool.query("SELECT * FROM users WHERE role = 'dispatcher' LIMIT 1");
    const drivers = await pool.query("SELECT * FROM users WHERE role = 'driver' LIMIT 1");
    
    console.log('--- DISPATCHER ---');
    console.log(dispatchers.rows);
    
    console.log('--- DRIVER ---');
    console.log(drivers.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
getUsers();
