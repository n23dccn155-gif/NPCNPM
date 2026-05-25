// app.js: Cấu hình Express App hoàn chỉnh
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const routeRoutes = require('./routes/routeRoutes');
const busRoutes = require('./routes/busRoutes');
const driverRoutes = require('./routes/driverRoutes');
const tripRoutes = require('./routes/tripRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const leaveRequestRoutes = require('./routes/leaveRequestRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const schedulerRoutes = require('./routes/schedulerRoutes');
const miscRoutes = require('./routes/miscRoutes');
const errorMiddleware = require('./middlewares/errorMiddleware');

const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/', (req, res) => res.json({ message: 'Bus Trip Assignment API - Running', version: '1.0.0' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api', miscRoutes);

// Error handler (always last)
app.use(errorMiddleware);

module.exports = app;
