/**
 * DATABASE.JS - Database Connection Configuration
 * 
 * Tạo và cấu hình Sequelize connection đến MySQL database.
 * 
 * Cấu hình pool:
 * - max: Số connection tối đa trong pool (5)
 * - min: Số connection tối thiểu (0)
 * - acquire: Thời gian chờ khi cần connection mới (30s)
 * - idle: Thời gian connection không dùng trước khi đóng (10s)
 * 
 * Logging: Chỉ bật trong development mode để xem SQL queries
 */

const { Sequelize } = require('sequelize');
const constants = require('./constants');

// Tạo Sequelize instance với cấu hình từ constants
const sequelize = new Sequelize(
  constants.DATABASE.NAME,
  constants.DATABASE.USER,
  constants.DATABASE.PASSWORD,
  {
    host: constants.DATABASE.HOST,
    dialect: constants.DATABASE.DIALECT,
    // Chỉ log SQL queries trong development mode
    logging: constants.SERVER.NODE_ENV === 'development' ? console.log : false,
    // Connection pool configuration để tối ưu performance
    pool: {
      max: 5,        // Tối đa 5 connections trong pool
      min: 0,        // Tối thiểu 0 connections
      acquire: 30000, // Chờ tối đa 30s để lấy connection
      idle: 10000,   // Đóng connection nếu không dùng trong 10s
    },
  }
);

module.exports = sequelize;

