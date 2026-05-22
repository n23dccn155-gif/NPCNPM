const express = require('express');
const router = express.Router();
const leaveRequestController = require('../controllers/leaveRequestController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

router.get('/my', auth, role(['driver']), leaveRequestController.getMy);
router.post('/', auth, role(['driver']), leaveRequestController.create);
router.get('/', auth, role(['admin', 'manager']), leaveRequestController.getAll);
router.patch('/:requestId/review', auth, role(['admin', 'manager']), leaveRequestController.review);
router.get('/:requestId/affected-trips', auth, role(['admin', 'dispatcher']), leaveRequestController.getAffectedTrips);

module.exports = router;
