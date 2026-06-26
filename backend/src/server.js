// server.js: Entry Point khởi chạy Server Backend

const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

const http = require('http');
const { initSocket } = require('./sockets/socketManager');

const server = http.createServer(app);

// Khởi tạo Socket.io
initSocket(server);

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`  SERVER ĐANG CHẠY TẠI PORT: ${PORT}`);
  console.log(`  ĐỊA CHỈ API: http://localhost:${PORT}`);
  console.log(`  SOCKET.IO SẴN SÀNG`);
  console.log(`=================================================`);
});
