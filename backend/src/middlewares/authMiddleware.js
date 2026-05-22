// authMiddleware.js: Xác thực JWT token của người dùng gửi lên

const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // Lấy token từ header Authorization (dạng "Bearer <token>")
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Không tìm thấy token xác thực. Vui lòng đăng nhập lại.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123');
    req.user = decoded; // Lưu thông tin người dùng vào request
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
    });
  }
};

module.exports = authMiddleware;
