/**
 * LOGGER.JS - Logging Utility
 * 
 * Cung cấp các hàm logging có cấu trúc:
 * - info: Log thông tin chung (chỉ trong development)
 * - error: Log lỗi (luôn hiển thị)
 * - warn: Log cảnh báo (luôn hiển thị)
 * - debug: Log để debug (chỉ trong development)
 * - request: Log mọi HTTP request (chỉ trong development)
 */

const constants = require('../config/constants');

const isDevelopment = constants.SERVER.NODE_ENV === 'development';

const logger = {
  // Log thông tin chung, chỉ hiển thị trong development mode
  info: (message, ...args) => {
    if (isDevelopment) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },

  // Log lỗi, luôn hiển thị trong mọi môi trường
  error: (message, ...args) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  },

  // Log cảnh báo, luôn hiển thị
  warn: (message, ...args) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  },

  // Log để debug, chỉ hiển thị trong development mode
  debug: (message, ...args) => {
    if (isDevelopment) {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },

  // Log HTTP request với method, URL, headers và body (nếu có)
  request: (req) => {
    if (isDevelopment) {
      console.log(`\n[REQUEST] [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
      if (req.headers['content-type']) {
        console.log('   Headers:', req.headers['content-type']);
      }
      if (req.body && Object.keys(req.body).length > 0) {
        console.log('   Body:', req.body);
      }
    }
  },
};

module.exports = logger;

