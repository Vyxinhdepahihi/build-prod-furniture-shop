// Standardized response helpers
const successResponse = (res, data, message = 'Thành công', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const errorResponse = (res, message = 'Lỗi server', statusCode = 500) => {
  res.status(statusCode).json({
    success: false,
    message,
  });
};

const paginatedResponse = (res, data, pagination, message = 'Thành công') => {
  res.json({
    success: true,
    message,
    data,
    pagination,
  });
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
};



