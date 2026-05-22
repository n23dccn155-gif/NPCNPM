// authRoutes.js: Các API liên quan đến xác thực tài khoản

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// Route đăng nhập công khai
router.post('/login', authController.login);

// Route lấy thông tin người dùng hiện tại (yêu cầu gửi kèm Token)
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
