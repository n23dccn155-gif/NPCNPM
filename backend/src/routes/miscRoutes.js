const express = require('express');
const router = express.Router();
const { tripLogController, reportController } = require('../controllers/tripLogController');
const { userController, configurationController } = require('../controllers/userController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

// Trip logs
router.get('/trip-logs', auth, tripLogController.getAll);
router.get('/trip-logs/:tripCode', auth, tripLogController.getOne);
router.post('/trip-logs', auth, role(['admin', 'dispatcher']), tripLogController.create);

// Reports
router.get('/reports/routes', auth, role(['admin', 'manager']), reportController.routeReport);
router.get('/reports/buses', auth, role(['admin', 'manager']), reportController.busReport);
router.get('/reports/drivers', auth, role(['admin', 'manager']), reportController.driverReport);

// Users
router.get('/users', auth, role(['admin']), userController.getAll);
router.post('/users', auth, role(['admin']), userController.create);
router.put('/users/:userId', auth, role(['admin']), userController.update);
router.patch('/users/:userId/status', auth, role(['admin']), userController.updateStatus);
router.patch('/users/:userId/role', auth, role(['admin']), userController.updateRole);
router.put('/profile/password', auth, userController.changePassword);

// Configurations
router.get('/configurations', auth, configurationController.getAll);
router.put('/configurations/:configKey', auth, role(['admin']), configurationController.update);

module.exports = router;
