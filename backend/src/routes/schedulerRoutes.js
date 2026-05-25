const express = require('express');
const router = express.Router();
const schedulerController = require('../controllers/schedulerController');
const protect = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Get daily schedule for all (Admin, Manager, Dispatcher)
router.get('/daily', protect, roleMiddleware(['admin', 'manager', 'dispatcher']), schedulerController.getDailySchedule);

// Get personal schedule (Driver)
router.get('/my-schedule', protect, roleMiddleware(['driver']), schedulerController.getMySchedule);

module.exports = router;
