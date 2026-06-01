// userRoutes.js: Các route quản lý tài khoản người dùng và hồ sơ cá nhân
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

// Quản trị viên quản lý user (ở đây manager có toàn quyền quản lý user)
router.get('/', auth, role(['manager']), userController.getAll);
router.post('/', auth, role(['manager']), userController.create);
router.put('/:userId', auth, role(['manager']), userController.update);
router.patch('/:userId/status', auth, role(['manager']), userController.updateStatus);

// Hồ sơ cá nhân người dùng hiện tại
router.put('/profile/password', auth, userController.changePassword);
router.put('/profile', auth, userController.updateProfile);

module.exports = router;
