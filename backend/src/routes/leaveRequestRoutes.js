// leaveRequestRoutes.js: Các route quản lý xin nghỉ phép của tài xế
const express = require('express');
const router = express.Router();
const leaveRequestController = require('../controllers/leaveRequestController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

router.get('/', auth, role(['manager', 'dispatcher']), leaveRequestController.getAll);
router.get('/my', auth, role(['driver']), leaveRequestController.getMy);
router.post('/', auth, role(['driver']), leaveRequestController.create);
router.post('/:requestId/review', auth, role(['manager']), leaveRequestController.review);
router.get('/:requestId/affected-groups', auth, role(['manager', 'dispatcher']), leaveRequestController.getAffectedGroups);

module.exports = router;
