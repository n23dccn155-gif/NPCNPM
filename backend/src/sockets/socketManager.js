// socketManager.js: Quản lý kết nối socket.io và map userId -> socketId
const socketIo = require('socket.io');

let io;
// Cấu trúc lưu trữ online users: Map<userId, socketId>
const onlineUsers = new Map();

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    // Nhận xác thực user từ client (gọi ngay sau khi socket kết nối).
    // QUAN TRỌNG: phải là user.id (int) từ JWT, không phải username.
    socket.on('authenticate', (userId) => {
      if (userId === undefined || userId === null || userId === '') {
        console.warn(`[Socket] authenticate received empty userId from ${socket.id}`);
        return;
      }
      const key = String(userId);
      // Nếu user đã có socket cũ, đóng socket cũ để tránh duplicate
      const oldSocketId = onlineUsers.get(key);
      if (oldSocketId && oldSocketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket) oldSocket.disconnect(true);
        console.log(`[Socket] Replaced old socket ${oldSocketId} for user ${key}`);
      }
      onlineUsers.set(key, socket.id);
      console.log(`[Socket] User ${key} authenticated with socket ${socket.id}. Online: ${onlineUsers.size}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} (reason: ${reason})`);
      for (let [userId, sId] of onlineUsers.entries()) {
        if (sId === socket.id) {
          onlineUsers.delete(userId);
          console.log(`[Socket] User ${userId} removed. Online: ${onlineUsers.size}`);
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

// Gửi event tới 1 user cụ thể. Trả về true nếu user đang online, false nếu không.
const emitToUser = (userId, eventName, data) => {
  if (!io) {
    console.warn('[Socket] emitToUser called before initSocket');
    return false;
  }
  if (userId === undefined || userId === null) {
    console.warn('[Socket] emitToUser called with empty userId');
    return false;
  }
  const socketId = onlineUsers.get(String(userId));
  if (!socketId) {
    // Không coi là lỗi - chỉ là user offline. Notification vẫn được lưu DB,
    // user sẽ thấy khi reload hoặc đăng nhập lại.
    return false;
  }
  io.to(socketId).emit(eventName, data);
  return true;
};

// Broadcast tới tất cả client đang kết nối
const broadcast = (eventName, data) => {
  if (!io) {
    console.warn('[Socket] broadcast called before initSocket');
    return;
  }
  io.emit(eventName, data);
};

// Helper: lấy danh sách user đang online (cho debug/admin)
const getOnlineUserIds = () => Array.from(onlineUsers.keys());

module.exports = {
  initSocket,
  getIo,
  emitToUser,
  broadcast,
  getOnlineUserIds
};
