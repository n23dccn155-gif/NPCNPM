// tripRoutes.js: Các route quản lý và ghi nhận hành trình chuyến xe
const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

router.get('/', auth, tripController.getAll);
router.get('/my-trips', auth, role(['driver']), tripController.getMyTrips);
router.get('/:tripId', auth, tripController.getOne);

// Tài xế xuất bến và hoàn thành chuyến
router.post('/:tripId/start', auth, role(['driver']), tripController.startTrip);
router.post('/:tripId/finish', auth, role(['driver']), tripController.finishTrip);

// Điều phối hủy chuyến xe
router.post('/:tripId/cancel', auth, role(['dispatcher']), tripController.cancelTrip);

module.exports = router;
