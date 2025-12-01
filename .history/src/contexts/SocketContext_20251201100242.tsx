'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Socket Context - Quản lý Socket.IO connection cho toàn bộ ứng dụng
 * 
 * Features:
 * - Tự động kết nối khi user đăng nhập (có token)
 * - Tự động ngắt kết nối khi user đăng xuất
 * - Lắng nghe các events từ server
 * - Provide socket instance cho các component con
 */

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  reconnect: () => void;
  disconnect: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  reconnect: () => {},
  disconnect: () => {},
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  /**
   * Kết nối Socket.IO
   * - Chỉ kết nối khi có token trong localStorage
   * - Gửi token trong auth để server verify
   */
  const connectSocket = () => {
    // Kiểm tra token
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('[Socket] Không có token, bỏ qua kết nối Socket.IO');
      return;
    }

    // Nếu đã có socket đang kết nối, không tạo mới
    if (socketRef.current && socketRef.current.connected) {
      console.log('[Socket] Socket đã được kết nối, bỏ qua');
      return;
    }

    // Ngắt kết nối cũ nếu có
    if (socketRef.current) {
      console.log('[Socket] Ngắt kết nối socket cũ');
      socketRef.current.disconnect();
    }

    console.log('[Socket] Đang kết nối Socket.IO...');

    // Tạo socket connection mới
    const newSocket = io('http://localhost:5001', {
      auth: {
        token: token, // JWT token để authenticate
      },
      transports: ['websocket', 'polling'], // Hỗ trợ cả websocket và polling
      reconnection: true, // Tự động reconnect khi mất kết nối
      reconnectionDelay: 1000, // Delay 1 giây trước khi reconnect
      reconnectionAttempts: 5, // Thử lại tối đa 5 lần
    });

    // Event: Kết nối thành công
    newSocket.on('connect', () => {
      console.log('[Socket] ✅ Đã kết nối Socket.IO - Socket ID:', newSocket.id);
      setIsConnected(true);
    });

    // Event: Ngắt kết nối
    newSocket.on('disconnect', (reason) => {
      console.log('[Socket] ❌ Đã ngắt kết nối Socket.IO - Lý do:', reason);
      setIsConnected(false);
    });

    // Event: Kết nối lại
    newSocket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] 🔄 Đã kết nối lại Socket.IO - Lần thử:', attemptNumber);
      setIsConnected(true);
    });

    // Event: Lỗi kết nối
    newSocket.on('connect_error', (error) => {
      console.error('[Socket] ⚠️ Lỗi kết nối Socket.IO:', error.message);
      setIsConnected(false);
    });

    // Event: User online (từ server)
    newSocket.on('user:online', (data) => {
      console.log('[Socket] 👤 User online:', data);
    });

    // Event: User offline (từ server)
    newSocket.on('user:offline', (data) => {
      console.log('[Socket] 👤 User offline:', data);
    });

    // Lưu socket vào ref và state
    socketRef.current = newSocket;
    setSocket(newSocket);
  };

  /**
   * Ngắt kết nối Socket.IO
   */
  const disconnectSocket = () => {
    if (socketRef.current) {
      console.log('[Socket] 🔌 Đang ngắt kết nối Socket.IO...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  };

  /**
   * Kết nối lại Socket.IO
   */
  const reconnect = () => {
    disconnectSocket();
    setTimeout(() => {
      connectSocket();
    }, 500);
  };

  /**
   * Effect: Tự động kết nối khi có token
   */
  useEffect(() => {
    // Kiểm tra token ban đầu
    const token = localStorage.getItem('token');
    if (token) {
      connectSocket();
    }

    // Lắng nghe event loginSuccess để kết nối khi đăng nhập
    const handleLoginSuccess = () => {
      console.log('[Socket] Nhận được event loginSuccess, kết nối Socket.IO...');
      setTimeout(() => {
        connectSocket();
      }, 500); // Delay một chút để đảm bảo token đã được lưu
    };

    // Lắng nghe event logout để ngắt kết nối ngay lập tức
    const handleLogout = () => {
      console.log('[Socket] Nhận được event logout, ngắt kết nối Socket.IO...');
      disconnectSocket();
    };

    // Lắng nghe event storage để kết nối khi token được cập nhật
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        if (e.newValue) {
          // Token mới được thêm, kết nối
          console.log('[Socket] Token mới được thêm, kết nối Socket.IO...');
          connectSocket();
        } else {
          // Token bị xóa, ngắt kết nối
          console.log('[Socket] Token bị xóa, ngắt kết nối Socket.IO...');
          disconnectSocket();
        }
      }
    };

    window.addEventListener('loginSuccess', handleLoginSuccess);
    window.addEventListener('logout', handleLogout);
    window.addEventListener('storage', handleStorageChange);

    // Cleanup khi component unmount
    return () => {
      window.removeEventListener('loginSuccess', handleLoginSuccess);
      window.removeEventListener('logout', handleLogout);
      window.removeEventListener('storage', handleStorageChange);
      disconnectSocket();
    };
  }, []);

  /**
   * Effect: Lắng nghe thay đổi token từ localStorage (trong cùng tab)
   * Sử dụng polling để kiểm tra token mỗi giây
   */
  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem('token');
      const isCurrentlyConnected = socketRef.current?.connected || false;

      if (token && !isCurrentlyConnected) {
        // Có token nhưng chưa kết nối, kết nối
        connectSocket();
      } else if (!token && isCurrentlyConnected) {
        // Không có token nhưng đang kết nối, ngắt kết nối
        disconnectSocket();
      }
    };

    // Kiểm tra ngay lập tức
    checkToken();

    // Kiểm tra mỗi giây
    const interval = setInterval(checkToken, 1000);

    return () => clearInterval(interval);
  }, []);

  const value: SocketContextType = {
    socket,
    isConnected,
    reconnect,
    disconnect: disconnectSocket,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

