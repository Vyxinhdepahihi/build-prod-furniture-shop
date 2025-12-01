/**
 * SOCKET SERVICE - Real-time User Tracking với Socket.IO
 * 
 * Service này quản lý:
 * - Socket.IO server instance
 * - Track users online/offline realtime
 * - Broadcast events đến admin clients
 * - Authentication cho socket connections
 */

const jwt = require('jsonwebtoken');
const constants = require('../config/constants');
const logger = require('../utils/logger');
const { UserModel } = require('../database');

// Map để lưu trữ socket connections: Map<userId, socketId>
const userSockets = new Map(); // Map<userId (string), socketId (string)>
const socketToUser = new Map(); // Map<socketId, userId> - để lookup ngược

/**
 * Initialize Socket.IO Server
 * 
 * @param {Server} httpServer - HTTP server instance từ Express
 * @returns {Server} Socket.IO server instance
 */
function initializeSocket(httpServer) {
  const { Server } = require('socket.io');
  
  const io = new Server(httpServer, {
    cors: {
      origin: constants.CORS.origin, // Cho phép các origin từ CORS config
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'], // Hỗ trợ cả websocket và polling
  });

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        logger.warn(`[Socket] Connection rejected: No token provided - Socket ID: ${socket.id}`);
        return next(new Error('Authentication required'));
      }

      try {
        const decoded = jwt.verify(token, constants.JWT.SECRET);
        
        // Verify user exists in database
        const user = await UserModel.findByPk(decoded.id, {
          attributes: ['id', 'email', 'ho_ten', 'role'],
        });

        if (!user) {
          logger.warn(`[Socket] Connection rejected: User not found - Socket ID: ${socket.id}, User ID: ${decoded.id}`);
          return next(new Error('User not found'));
        }

        // Gắn user info vào socket để sử dụng sau
        socket.userId = String(user.id);
        socket.userEmail = user.email;
        socket.userRole = user.role;

        logger.info(`[Socket] Authentication successful - Socket ID: ${socket.id}, User: ${user.email} (${user.id})`);
        next();
      } catch (jwtError) {
        logger.warn(`[Socket] JWT verification failed - Socket ID: ${socket.id}, Error: ${jwtError.message}`);
        return next(new Error('Invalid token'));
      }
    } catch (error) {
      logger.error(`[Socket] Authentication error - Socket ID: ${socket.id}, Error:`, error);
      next(new Error('Authentication failed'));
    }
  });

  // Handle Socket Connection
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const userEmail = socket.userEmail;

    logger.info(`[Socket] User connected - Socket ID: ${socket.id}, User: ${userEmail} (${userId})`);

    // Lưu mapping: userId -> socketId
    userSockets.set(userId, socket.id);
    socketToUser.set(socket.id, userId);

    // Emit event để notify admin về user mới online
    io.emit('user:online', {
      userId,
      userEmail,
      timestamp: new Date().toISOString(),
    });

    // Log số lượng users online hiện tại
    logger.info(`[Socket] Total online users: ${userSockets.size}`);

    // Handle Disconnect
    socket.on('disconnect', (reason) => {
      logger.info(`[Socket] User disconnected - Socket ID: ${socket.id}, User: ${userEmail} (${userId}), Reason: ${reason}`);

      // Xóa mapping
      userSockets.delete(userId);
      socketToUser.delete(socket.id);

      // Emit event để notify admin về user offline
      io.emit('user:offline', {
        userId,
        userEmail,
        timestamp: new Date().toISOString(),
      });

      logger.info(`[Socket] Total online users: ${userSockets.size}`);
    });

    // Handle ping/pong để check connection
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Join admin room (nếu user là admin)
    if (socket.userRole === 'admin') {
      socket.join('admin');
      logger.info(`[Socket] Admin joined admin room - Socket ID: ${socket.id}, User: ${userEmail}`);
    }
  });

  logger.info('[Socket] Socket.IO server initialized successfully');
  return io;
}

/**
 * Get Online Users Count
 * 
 * @returns {number} Số lượng users đang online
 */
function getOnlineUsersCount() {
  return userSockets.size;
}

/**
 * Get Online Users List
 * 
 * @returns {Array<{userId: string, socketId: string}>} Danh sách users online
 */
function getOnlineUsersList() {
  return Array.from(userSockets.entries()).map(([userId, socketId]) => ({
    userId,
    socketId,
  }));
}

/**
 * Check if User is Online
 * 
 * @param {string} userId - User ID cần kiểm tra
 * @returns {boolean} True nếu user đang online
 */
function isUserOnline(userId) {
  return userSockets.has(String(userId));
}

/**
 * Get Socket ID by User ID
 * 
 * @param {string} userId - User ID
 * @returns {string|null} Socket ID hoặc null nếu không tìm thấy
 */
function getSocketIdByUserId(userId) {
  return userSockets.get(String(userId)) || null;
}

/**
 * Get User ID by Socket ID
 * 
 * @param {string} socketId - Socket ID
 * @returns {string|null} User ID hoặc null nếu không tìm thấy
 */
function getUserIdBySocketId(socketId) {
  return socketToUser.get(socketId) || null;
}

module.exports = {
  initializeSocket,
  getOnlineUsersCount,
  getOnlineUsersList,
  isUserOnline,
  getSocketIdByUserId,
  getUserIdBySocketId,
};



