const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

router.get('/', auth, tripController.getAll);
router.get('/:tripCode', auth, tripController.getOne);
router.post('/', auth, role(['admin', 'dispatcher']), tripController.create);

module.exports = router;
