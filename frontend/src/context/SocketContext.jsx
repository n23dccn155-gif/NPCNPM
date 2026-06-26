import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Only connect if user is logged in
    if (user && user.user_id) {
      // Connect to the backend
      const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
      
      newSocket.on('connect', () => {
        console.log('[Socket] Connected to server');
        // Send user_id to register this connection
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
