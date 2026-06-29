// notificationRoutes.js: Các route quản lý thông báo người dùng
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middlewares/authMiddleware');

router.get('/my', auth, notificationController.getMy);
router.get('/history', auth, notificationController.getHistory);
router.patch('/:notificationId/read', auth, notificationController.markAsRead);
router.post('/read-all', auth, notificationController.markAllAsRead);
router.delete('/:notificationId', auth, notificationController.deleteOne);
router.delete('/', auth, notificationController.deleteAllRead);

module.exports = router;
