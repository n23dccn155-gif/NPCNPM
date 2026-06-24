require('dotenv').config();
const jwt = require('jsonwebtoken');

async function test() {
  try {
    const token = jwt.sign(
      { id: 1, role: 'manager' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );
    
    console.log('Sending request...');
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
  }
}
test();
