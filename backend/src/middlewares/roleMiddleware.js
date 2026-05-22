// roleMiddleware.js: Kiểm tra phân quyền vai trò người dùng

/**
 * Cho phép các vai trò được chỉ định đi qua, chặn các vai trò khác
 * @param {Array<string>} allowedRoles - Danh sách tên vai trò được phép (ví dụ: ['admin', 'manager'])
 */
const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Bạn chưa xác thực thông tin.',
      });
    }

    // req.user.roleName được giải mã từ JWT token
    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện chức năng này.',
      });
    }

    next();
  };
};

module.exports = roleMiddleware;
