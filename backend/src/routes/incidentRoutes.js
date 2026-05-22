const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

router.post('/', auth, role(['driver']), incidentController.create);
router.get('/my', auth, role(['driver']), incidentController.getMy);
router.get('/', auth, role(['admin', 'dispatcher']), incidentController.getAll);
router.patch('/:incidentId/status', auth, role(['admin', 'dispatcher']), incidentController.updateStatus);
router.get('/:incidentId/affected-trips', auth, role(['admin', 'dispatcher']), incidentController.getAffectedTrips);

module.exports = router;
