// reportRoutes.js: Các route báo cáo hiệu suất và thống kê vận hành
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

router.get('/routes', auth, role(['manager']), reportController.routeReport);
router.get('/buses', auth, role(['manager']), reportController.busReport);
router.get('/drivers', auth, role(['manager']), reportController.driverReport);

module.exports = router;
