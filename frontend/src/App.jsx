import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { PrivateRoute, PublicRoute } from './routes/AppRoutes';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Pages
import Login from './pages/auth/Login';

// Shared
import Dashboard from './pages/shared/Dashboard';
import Profile from './pages/shared/Profile';
import NotificationHistory from './pages/shared/NotificationHistory';

// Manager
import RouteList from './pages/manager/RouteList';
import BusList from './pages/manager/BusList';
import DriverList from './pages/manager/DriverList';
import LeaveApproval from './pages/manager/LeaveApproval';
import Reports from './pages/manager/Reports';
import UserList from './pages/manager/UserList';
import RouteDriverManage from './pages/manager/RouteDriverManage';
import PlanApproval from './pages/manager/PlanApproval';

// Dispatcher
import AutoSchedulerPage from './pages/dispatcher/AutoSchedulerPage';
import ScheduleCalendar from './pages/dispatcher/ScheduleCalendar';
import AffectedTrips from './pages/dispatcher/AffectedTrips';
import IncidentManage from './pages/dispatcher/IncidentManage';
import AssignmentList from './pages/dispatcher/AssignmentList';
import GpsTracking from './pages/dispatcher/GpsTracking';
import TripTracking from './pages/dispatcher/TripTracking';

// Driver
import MyAssignmentsPage from './pages/driver/MyAssignmentsPage';
import LeaveRequest from './pages/driver/LeaveRequest';
import IncidentReport from './pages/driver/IncidentReport';

const ALL_ROLES = ['manager', 'dispatcher', 'driver'];

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover />
          <Routes>
            {/* Public */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/unauthorized" element={
            <div className="flex items-center justify-center min-h-screen bg-slate-100">
              <div className="text-center bg-white p-10 rounded-2xl shadow-lg">
                <div className="text-5xl mb-4">🚫</div>
                <h1 className="text-xl font-bold text-gray-800 mb-2">Không có quyền truy cập</h1>
                <p className="text-gray-500 text-sm">Bạn không có quyền xem trang này.</p>
                <a href="/login" className="mt-4 inline-block text-blue-600 hover:underline text-sm">← Quay lại đăng nhập</a>
              </div>
            </div>
          } />

          {/* Shared Routes - accessible by all roles */}
          <Route path="/dashboard" element={<PrivateRoute allowedRoles={ALL_ROLES}><Dashboard /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute allowedRoles={ALL_ROLES}><Profile /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute allowedRoles={ALL_ROLES}><NotificationHistory /></PrivateRoute>} />

          {/* Manager Routes */}
          <Route path="/manager" element={<Navigate to="/manager/routes" replace />} />
          <Route path="/manager/routes" element={<PrivateRoute allowedRoles={['manager']}><RouteList /></PrivateRoute>} />
          <Route path="/manager/buses" element={<PrivateRoute allowedRoles={['manager']}><BusList /></PrivateRoute>} />
          <Route path="/manager/drivers" element={<PrivateRoute allowedRoles={['manager']}><DriverList /></PrivateRoute>} />
          <Route path="/manager/users" element={<PrivateRoute allowedRoles={['manager']}><UserList /></PrivateRoute>} />
          <Route path="/manager/leave-requests" element={<PrivateRoute allowedRoles={['manager']}><LeaveApproval /></PrivateRoute>} />
          <Route path="/manager/reports" element={<PrivateRoute allowedRoles={['manager']}><Reports /></PrivateRoute>} />
          <Route path="/manager/plan-approval" element={<PrivateRoute allowedRoles={['manager']}><PlanApproval /></PrivateRoute>} />

          {/* Dispatcher Routes */}
          <Route path="/dispatcher" element={<Navigate to="/dispatcher/calendar" replace />} />
          <Route path="/dispatcher/calendar" element={<PrivateRoute allowedRoles={['dispatcher', 'manager']}><ScheduleCalendar /></PrivateRoute>} />
          <Route path="/dispatcher/auto-scheduler" element={<PrivateRoute allowedRoles={['dispatcher', 'manager']}><AutoSchedulerPage /></PrivateRoute>} />
          <Route path="/dispatcher/route-buses" element={<PrivateRoute allowedRoles={['dispatcher', 'manager']}><RouteDriverManage /></PrivateRoute>} />
          <Route path="/dispatcher/route-drivers" element={<PrivateRoute allowedRoles={['dispatcher', 'manager']}><RouteDriverManage /></PrivateRoute>} />
          <Route path="/dispatcher/trips" element={<PrivateRoute allowedRoles={['dispatcher', 'manager']}><TripTracking /></PrivateRoute>} />
          <Route path="/dispatcher/affected-trips" element={<PrivateRoute allowedRoles={['dispatcher']}><AffectedTrips /></PrivateRoute>} />
          <Route path="/dispatcher/incidents" element={<PrivateRoute allowedRoles={['dispatcher']}><IncidentManage /></PrivateRoute>} />
          <Route path="/dispatcher/assignments" element={<PrivateRoute allowedRoles={['dispatcher']}><AssignmentList /></PrivateRoute>} />
          <Route path="/dispatcher/gps" element={<PrivateRoute allowedRoles={['dispatcher', 'manager']}><GpsTracking /></PrivateRoute>} />

          {/* Driver Routes */}
          <Route path="/driver" element={<Navigate to="/driver/schedule" replace />} />
          <Route path="/driver/schedule" element={<PrivateRoute allowedRoles={['driver']}><MyAssignmentsPage /></PrivateRoute>} />
          <Route path="/driver/leave" element={<PrivateRoute allowedRoles={['driver']}><LeaveRequest /></PrivateRoute>} />
          <Route path="/driver/incidents" element={<PrivateRoute allowedRoles={['driver']}><IncidentReport /></PrivateRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
