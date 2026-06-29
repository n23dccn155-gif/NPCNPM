// authController.js: Xử lý nghiệp vụ đăng nhập và hồ sơ cá nhân theo thiết kế mới

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

      // Tìm user theo username
      const queryText = `
        SELECT user_id, username, password_hash, full_name, role, status 
        FROM users 
        WHERE username = $1
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
      const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
        });
      }

      // Nếu là driver, lấy thêm driver_id, phone, license_class
      let driver_id = null;
      let phone = null;
      let license_class = null;
      if (user.role === 'driver') {
        const driverQuery = await pool.query('SELECT driver_id, phone, license_class FROM drivers WHERE user_id = $1', [user.user_id]);
        if (driverQuery.rows.length > 0) {
          driver_id = driverQuery.rows[0].driver_id;
          phone = driverQuery.rows[0].phone;
          license_class = driverQuery.rows[0].license_class;
        }
      }

      // Tạo JWT token
      const token = jwt.sign(
        {
          id: user.user_id,
          username: user.username,
          role: user.role,
          driver_id: driver_id
        },
        process.env.JWT_SECRET || 'supersecretkey123',
        { expiresIn: '24h' }
      );

      res.status(200).json({
        success: true,
        message: 'Đăng nhập thành công.',
        token,
        user: {
          id: user.user_id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          driver_id: driver_id,
          phone: phone,
          license_class: license_class
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
        SELECT user_id, username, full_name, role, status 
        FROM users 
        WHERE user_id = $1
      `;
      const result = await pool.query(queryText, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng.',
        });
      }

      const user = result.rows[0];

      // Nếu là driver, lấy thêm driver_id, phone, license_class
      let driver_id = null;
      let phone = null;
      let license_class = null;
      if (user.role === 'driver') {
        const driverQuery = await pool.query('SELECT driver_id, phone, license_class FROM drivers WHERE user_id = $1', [user.user_id]);
        if (driverQuery.rows.length > 0) {
          driver_id = driverQuery.rows[0].driver_id;
          phone = driverQuery.rows[0].phone;
          license_class = driverQuery.rows[0].license_class;
        }
      }

      res.status(200).json({
        success: true,
        user: {
          id: user.user_id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          driver_id: driver_id,
          phone: phone,
          license_class: license_class
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = authController;
