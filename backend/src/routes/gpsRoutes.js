// gpsRoutes.js: Routes cho hệ thống GPS tracking
const express = require('express');
const router = express.Router();
const gpsController = require('../controllers/gpsController');
const auth = require('../middlewares/authMiddleware');

// ============== INGEST (mở, không cần JWT, thiết bị GPS gọi vào) ==============
// Trong thực tế: nên bảo vệ bằng API key trong header 'x-gps-key'.
// Ở phiên bản này: chỉ yêu cầu device_code đúng, đơn giản cho thiết bị nội bộ.
router.post('/ingest', gpsController.ingest);

// ============== DEVICES (quản lý thiết bị) ==============
router.get('/devices', auth, gpsController.listDevices);
router.post('/devices', auth, gpsController.registerDevice);
router.patch('/devices/:id', auth, gpsController.updateDevice);

// ============== TRACKING (xem vị trí realtime + lịch sử) ==============
router.get('/tracking', auth, gpsController.getCurrentLocations);
router.get('/tracking/:busId', auth, gpsController.getCurrentByBus);
router.get('/history/:busId', auth, gpsController.getHistory);

// ============== ROUTE POLYLINES ==============
router.post('/polylines', auth, gpsController.upsertPolyline);
router.get('/polylines/:routeCode/:directionType', auth, gpsController.getPolyline);

// ============== ALERTS ==============
router.get('/alerts', auth, gpsController.listAlerts);
router.patch('/alerts/:id/acknowledge', auth, gpsController.acknowledgeAlert);
router.patch('/alerts/:id/resolve', auth, gpsController.resolveAlert);

// ============== RULES ==============
router.get('/rules', auth, gpsController.listRules);
router.patch('/rules/:id', auth, gpsController.updateRule);

module.exports = router;