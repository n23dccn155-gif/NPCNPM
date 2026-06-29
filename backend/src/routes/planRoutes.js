// planRoutes.js: Các route quản lý kế hoạch vận doanh, sinh chuyến và duyệt kế hoạch
const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');
const assignmentController = require('../controllers/assignmentController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

router.get('/latest-date/:routeCode', auth, planController.getLatestDate);
router.get('/', auth, planController.getAll);
router.post('/review-batch', auth, role(['manager']), planController.reviewBatchPlan);
router.get('/:planId', auth, planController.getOne);
router.post('/', auth, role(['dispatcher']), planController.create);
router.post('/:planId/generate-trips', auth, role(['dispatcher']), planController.generateTrips);
router.post('/:planId/auto-assign', auth, role(['dispatcher']), assignmentController.autoAssignPlan);
router.post('/:planId/submit', auth, role(['dispatcher']), planController.submitPlan);
router.post('/:planId/review', auth, role(['manager']), planController.reviewPlan);
router.delete('/:planId', auth, role(['dispatcher', 'manager']), planController.deletePlan);

module.exports = router;
