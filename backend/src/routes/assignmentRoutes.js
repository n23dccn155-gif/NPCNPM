const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

router.get('/schedule', auth, assignmentController.getSchedule);
router.get('/my-schedule', auth, role(['driver']), assignmentController.getMySchedule);
router.post('/check', auth, role(['admin', 'dispatcher']), assignmentController.check);
router.post('/', auth, role(['admin', 'dispatcher']), assignmentController.create);
router.post('/:tripCode/replace', auth, role(['admin', 'dispatcher']), assignmentController.replace);
router.get('/history/:tripCode', auth, assignmentController.getHistory);

module.exports = router;
