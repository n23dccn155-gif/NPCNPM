// busRoutes.js: Các route quản lý danh sách xe buýt
const express = require('express');
const router = express.Router();
const busController = require('../controllers/busController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

router.get('/', auth, busController.getAll);
router.get('/:busId', auth, busController.getOne);
router.post('/', auth, role(['manager']), busController.create);
router.put('/:busId', auth, role(['manager']), busController.update);
router.patch('/:busId/status', auth, role(['manager', 'dispatcher']), busController.updateStatus);

module.exports = router;
