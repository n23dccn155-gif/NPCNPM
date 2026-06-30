// app.js: Cấu hình Express App hoàn chỉnh theo thiết kế mới
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const routeRoutes = require('./routes/routeRoutes');
const busRoutes = require('./routes/busRoutes');
const driverRoutes = require('./routes/driverRoutes');
const planRoutes = require('./routes/planRoutes');
const tripRoutes = require('./routes/tripRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const leaveRequestRoutes = require('./routes/leaveRequestRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');

const errorMiddleware = require('./middlewares/errorMiddleware');

const realtime = require('./utils/realtime');

const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Realtime SSE endpoint
app.get('/api/realtime/events', realtime.registerClient);

// Health check
app.get('/', (req, res) => res.json({ message: 'Bus Trip Assignment API - Running', version: '2.0.0' }));

// Registered Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);

// Error handler (always last)
app.use(errorMiddleware);

module.exports = app;
