const socketIo = require('socket.io');

let io;
// Cấu trúc lưu trữ online users: Map<userId, socketId>
const onlineUsers = new Map();

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"]
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    socket.on('authenticate', (userId) => {
      if (userId) {
        onlineUsers.set(String(userId), socket.id);
        console.log(`[Socket] User ${userId} connected with socket ${socket.id}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      for (let [userId, sId] of onlineUsers.entries()) {
        if (sId === socket.id) {
          onlineUsers.delete(userId);
          console.log(`[Socket] User ${userId} disconnected`);
          break;
        }
      }
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    console.warn('Socket.io is not initialized!');
    return null;
  }
  return io;
};

const emitToUser = (userId, eventName, data) => {
  if (!io) return;
  const socketId = onlineUsers.get(String(userId));
  if (socketId) {
    io.to(socketId).emit(eventName, data);
  }
};

const broadcast = (eventName, data) => {
  if (!io) return;
  io.emit(eventName, data);
};

module.exports = {
  initSocket,
  getIo,
  emitToUser,
  broadcast
};
