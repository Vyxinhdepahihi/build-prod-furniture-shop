/**
 * ERRORS.JS - Error Handling Utilities
 * 
 * Cung cấp:
 * - AppError: Custom error class với status code
 * - errorHandler: Middleware xử lý lỗi toàn cục
 * - asyncHandler: Wrapper để tự động catch lỗi trong async routes
 */

const logger = require('./logger');

/**
 * AppError - Custom Error Class
 * 
 * Dùng để tạo error với status code và message rõ ràng
 * @param {string} message - Thông báo lỗi
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {boolean} isOperational - Có phải lỗi nghiệp vụ không (default: true)
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    // Giữ lại stack trace để debug
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error Handler Middleware
 * 
 * Bắt tất cả lỗi từ routes và xử lý:
 * - Log lỗi ra console
 * - Chuyển đổi Sequelize errors thành AppError
 * - Chuyển đổi JWT errors thành AppError
 * - Trả về response JSON với status code phù hợp
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log chi tiết lỗi để debug
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
  });

  // Xử lý Sequelize Validation Error
  // Khi validate dữ liệu không đúng format (ví dụ: email không hợp lệ)
  if (err.name === 'SequelizeValidationError') {
    const message = err.errors.map((e) => e.message).join(', ');
    error = new AppError(message, 400);
  }

  // Xử lý Sequelize Unique Constraint Error
  // Khi insert dữ liệu trùng unique field (ví dụ: email đã tồn tại)
  if (err.name === 'SequelizeUniqueConstraintError') {
    const message = 'Dữ liệu đã tồn tại trong hệ thống';
    error = new AppError(message, 409);
  }

  // Xử lý Sequelize Foreign Key Constraint Error
  // Khi tham chiếu đến record không tồn tại (ví dụ: user_id không tồn tại)
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    const message = 'Dữ liệu liên quan không tồn tại';
    error = new AppError(message, 400);
  }

  // Xử lý JWT Errors
  // Token không hợp lệ (không đúng format)
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Token không hợp lệ', 401);
  }

  // Token đã hết hạn
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token đã hết hạn', 401);
  }

  // Trả về response JSON với status code và message
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Lỗi server',
    // Chỉ hiển thị stack trace trong development mode để bảo mật
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Async Handler Wrapper
 * 
 * Tự động catch lỗi từ async functions trong routes
 * Giúp không cần viết try-catch trong mọi route handler
 * 
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function với error handling
 * 
 * Usage:
 * router.get('/', asyncHandler(async (req, res) => {
 *   // Code tự động được wrap trong try-catch
 * }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  errorHandler,
  asyncHandler,
};

