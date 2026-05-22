// errorMiddleware.js: Xử lý lỗi tập trung

const errorMiddleware = (err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Đã xảy ra lỗi hệ thống';

  res.status(statusCode).json({
    success: false,
    message,
    // Chỉ hiển thị stack trace ở môi trường phát triển
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorMiddleware;
