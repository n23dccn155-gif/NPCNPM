import React, { createContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (user && user.id) {
      // Lấy URL socket: VITE_API_URL có thể là 'http://localhost:5000' hoặc có /api.
      // Socket.io cần URL gốc (không có /api).
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const socketUrl = apiBase.replace(/\/api\/?$/, '').replace(/\/$/, '');

      const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      newSocket.on('connect', () => {
        console.log('[Socket] Connected to server');
        // SỬA BUG: AuthContext lưu `user.id` (xem authController.login trả về
        // { id, username, full_name, role, driver_id }), không phải `user.user_id`.
        // Trước đây emit 'undefined' khiến server không map được socket → không nhận notification real-time.
        newSocket.emit('authenticate', user.id);
      });

      newSocket.on('connect_error', (err) => {
        console.warn('[Socket] Connection error:', err.message);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, user }}>
      {children}
    </SocketContext.Provider>
  );
};
