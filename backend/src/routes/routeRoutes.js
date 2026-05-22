const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

router.get('/', auth, routeController.getAll);
router.get('/:routeCode', auth, routeController.getOne);
router.post('/', auth, role(['admin', 'manager']), routeController.create);
router.put('/:routeCode', auth, role(['admin', 'manager']), routeController.update);
router.patch('/:routeCode/status', auth, role(['admin', 'manager']), routeController.updateStatus);

module.exports = router;
