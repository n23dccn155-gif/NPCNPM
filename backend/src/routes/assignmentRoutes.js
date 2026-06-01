// assignmentRoutes.js: Các route quản lý phân công nhóm chuyến
const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

router.get('/', auth, assignmentController.getAll);
router.post('/assign', auth, role(['dispatcher']), assignmentController.assignGroup);
router.post('/replace-driver', auth, role(['dispatcher']), assignmentController.replaceDriver);
router.post('/replace-bus', auth, role(['dispatcher']), assignmentController.replaceBus);
router.get('/available-resources/:groupId', auth, role(['dispatcher']), assignmentController.getAvailableResources);

module.exports = router;
