// driverRoutes.js: Các route quản lý danh sách tài xế
const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

router.get('/', auth, driverController.getAll);
router.get('/:driverId', auth, driverController.getOne);
router.post('/', auth, role(['manager']), driverController.create);
router.put('/:driverId', auth, role(['manager']), driverController.update);
router.patch('/:driverId/status', auth, role(['manager']), driverController.updateStatus);

module.exports = router;
