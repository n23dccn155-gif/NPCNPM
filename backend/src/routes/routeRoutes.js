const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const batchController = require('../controllers/batchController');
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

// Bus stops
router.get('/directions/:directionId/stops', auth, routeController.getStopsByDirection);
router.post('/stops', auth, role(['manager']), routeController.createStop);
router.put('/stops/:stopId', auth, role(['manager']), routeController.updateStop);
router.delete('/stops/:stopId', auth, role(['manager']), routeController.deleteStop);

// Route directions
router.get('/:routeCode/directions', auth, routeController.getDirectionsByRoute);
router.post('/:routeCode/directions', auth, role(['manager']), routeController.createDirection);
router.put('/:routeCode/directions/:directionId', auth, role(['manager']), routeController.updateDirection);

// Routes
router.get('/', auth, routeController.getAll);
router.get('/:routeCode', auth, routeController.getOne);
router.post('/', auth, role(['manager']), routeController.create);
router.put('/:routeCode', auth, role(['manager']), routeController.update);
router.patch('/:routeCode/status', auth, role(['manager']), routeController.updateStatus);
router.delete('/:routeCode', auth, role(['manager']), routeController.deleteRoute);

// Batch schedule generation
router.post('/:routeCode/generate-schedule', auth, role(['manager', 'dispatcher']), batchController.generate2Months);

// Route buses
router.post('/:routeCode/buses', auth, role(['manager', 'dispatcher']), routeController.addBusToRoute);
router.get('/:routeCode/buses', auth, routeController.getRouteBuses);
router.delete('/:routeCode/buses/:busId', auth, role(['manager', 'dispatcher']), routeController.removeBusFromRoute);

// Route drivers
router.post('/:routeCode/drivers', auth, role(['manager', 'dispatcher']), routeController.addDriverToRoute);
router.get('/:routeCode/drivers', auth, routeController.getRouteDrivers);
router.delete('/:routeCode/drivers/:driverId', auth, role(['manager', 'dispatcher']), routeController.removeDriverFromRoute);

module.exports = router;
