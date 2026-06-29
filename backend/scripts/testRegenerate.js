require('dotenv').config();
const pool = require('../src/config/database');
const jwt = require('jsonwebtoken');

async function test() {
  try {
    console.log('Clearing old plans and assignments for route 150...');
    await pool.query('DELETE FROM operation_plans WHERE route_code = $1', ['150']);
    
    console.log('Generating new schedules...');
    const token = jwt.sign(
      { id: 1, role: 'manager' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );
    
    const res = await fetch('http://localhost:5000/api/routes/150/generate-schedule', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();
    console.log('Response:', data);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
test();
