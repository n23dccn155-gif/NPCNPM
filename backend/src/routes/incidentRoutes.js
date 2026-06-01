// incidentRoutes.js: Các route báo cáo và xử lý sự cố vận hành
const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

router.get('/', auth, role(['manager', 'dispatcher']), incidentController.getAll);
router.get('/my', auth, role(['driver']), incidentController.getMy);
router.post('/', auth, role(['driver']), incidentController.create);
router.patch('/:incidentId/status', auth, role(['dispatcher']), incidentController.updateStatus);
router.get('/:incidentId/affected-groups', auth, role(['dispatcher']), incidentController.getAffectedGroups);

module.exports = router;
