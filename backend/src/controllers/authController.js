// authController.js: Xử lý nghiệp vụ đăng nhập và hồ sơ cá nhân

const pool = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const authController = {
  // Đăng nhập
  login: async (req, res, next) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng điền đầy đủ tên đăng nhập và mật khẩu.',
        });
      }

      // Tìm user kèm role_name
      const queryText = `
        SELECT u.id, u.username, u.full_name, u.phone, u.password, u.status, r.role_name 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.username = $1
      `;
      const result = await pool.query(queryText, [username]);

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
        });
      }

      const user = result.rows[0];

      // Kiểm tra trạng thái tài khoản
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động.',
        });
      }

      // So sánh mật khẩu băm
      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
        });
      }

      // Tạo JWT token
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          role: user.role_name,
        },
        process.env.JWT_SECRET || 'supersecretkey123',
        { expiresIn: '24h' }
      );

      res.status(200).json({
        success: true,
        message: 'Đăng nhập thành công.',
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          phone: user.phone,
          role: user.role_name,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Lấy thông tin user hiện tại đang đăng nhập
  getMe: async (req, res, next) => {
    try {
      const userId = req.user.id;

      const queryText = `
        SELECT u.id, u.username, u.full_name, u.phone, u.status, r.role_name 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = $1
      `;
      const result = await pool.query(queryText, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng.',
        });
      }

      const user = result.rows[0];

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          phone: user.phone,
          role: user.role_name,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = authController;
