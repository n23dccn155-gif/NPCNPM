import React, { createContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';   

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();   
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (user && user.user_id) {
      const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
      
      newSocket.on('connect', () => {
        console.log('[Socket] Connected to server');
        newSocket.emit('authenticate', user.user_id);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};