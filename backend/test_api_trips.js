const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const token = JSON.parse(data).token;
    
    // Now request trips API
    const options2 = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/trips',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    const req2 = http.request(options2, res2 => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => {
        console.log("Status:", res2.statusCode);
        console.log("Response:", data2.substring(0, 500)); // print first 500 chars
      });
    });
    req2.end();
  });
});

req.write(JSON.stringify({ username: 'admin', password: '123456' }));
req.end();
