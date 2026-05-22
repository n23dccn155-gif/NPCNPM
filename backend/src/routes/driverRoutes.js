const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

router.get('/', auth, driverController.getAll);
router.get('/:driverCode', auth, driverController.getOne);
router.post('/', auth, role(['admin', 'manager']), driverController.create);
router.put('/:driverCode', auth, role(['admin', 'manager']), driverController.update);
router.patch('/:driverCode/status', auth, role(['admin', 'manager']), driverController.updateStatus);

module.exports = router;
