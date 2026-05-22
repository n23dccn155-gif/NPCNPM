// server.js: Entry Point khởi chạy Server Backend

const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`  SERVER ĐANG CHẠY TẠI PORT: ${PORT}`);
  console.log(`  ĐỊA CHỈ API: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
