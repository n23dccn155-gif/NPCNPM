import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute, PublicRoute } from './routes/AppRoutes';

// Pages
import Login from './pages/auth/Login';

// Shared
import Dashboard from './pages/shared/Dashboard';
import Profile from './pages/shared/Profile';

// Manager
import RouteList from './pages/manager/RouteList';
import BusList from './pages/manager/BusList';
import DriverList from './pages/manager/DriverList';
import LeaveApproval from './pages/manager/LeaveApproval';
import Reports from './pages/manager/Reports';
import UserList from './pages/manager/UserList';
import RouteDriverManage from './pages/manager/RouteDriverManage';
import DirectionStopManage from './pages/manager/DirectionStopManage';
import PlanApproval from './pages/manager/PlanApproval';

// Dispatcher
import AutoSchedulerPage from './pages/dispatcher/AutoSchedulerPage';
import ScheduleCalendar from './pages/dispatcher/ScheduleCalendar';
import AffectedTrips from './pages/dispatcher/AffectedTrips';
import IncidentManage from './pages/dispatcher/IncidentManage';

// Driver
import MyAssignmentsPage from './pages/driver/MyAssignmentsPage';
import LeaveRequest from './pages/driver/LeaveRequest';
import IncidentReport from './pages/driver/IncidentReport';

const ALL_ROLES = ['manager', 'dispatcher', 'driver'];

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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

          {/* Manager Routes */}
          <Route path="/manager" element={<Navigate to="/manager/routes" replace />} />
          <Route path="/manager/routes" element={<PrivateRoute allowedRoles={['manager']}><RouteList /></PrivateRoute>} />
          <Route path="/manager/buses" element={<PrivateRoute allowedRoles={['manager']}><BusList /></PrivateRoute>} />
          <Route path="/manager/drivers" element={<PrivateRoute allowedRoles={['manager']}><DriverList /></PrivateRoute>} />
          <Route path="/manager/users" element={<PrivateRoute allowedRoles={['manager']}><UserList /></PrivateRoute>} />
          <Route path="/manager/leave-requests" element={<PrivateRoute allowedRoles={['manager']}><LeaveApproval /></PrivateRoute>} />
          <Route path="/manager/reports" element={<PrivateRoute allowedRoles={['manager']}><Reports /></PrivateRoute>} />
          <Route path="/manager/direction-stops" element={<PrivateRoute allowedRoles={['manager']}><DirectionStopManage /></PrivateRoute>} />
          <Route path="/manager/plan-approval" element={<PrivateRoute allowedRoles={['manager']}><PlanApproval /></PrivateRoute>} />

          {/* Dispatcher Routes */}
          <Route path="/dispatcher" element={<Navigate to="/dispatcher/calendar" replace />} />
          <Route path="/dispatcher/calendar" element={<PrivateRoute allowedRoles={['dispatcher', 'manager']}><ScheduleCalendar /></PrivateRoute>} />
          <Route path="/dispatcher/route-drivers" element={<PrivateRoute allowedRoles={['dispatcher', 'manager']}><RouteDriverManage /></PrivateRoute>} />
          <Route path="/dispatcher/affected-trips" element={<PrivateRoute allowedRoles={['dispatcher']}><AffectedTrips /></PrivateRoute>} />
          <Route path="/dispatcher/incidents" element={<PrivateRoute allowedRoles={['dispatcher']}><IncidentManage /></PrivateRoute>} />

          {/* Driver Routes */}
          <Route path="/driver" element={<Navigate to="/driver/schedule" replace />} />
          <Route path="/driver/schedule" element={<PrivateRoute allowedRoles={['driver']}><MyAssignmentsPage /></PrivateRoute>} />
          <Route path="/driver/leave" element={<PrivateRoute allowedRoles={['driver']}><LeaveRequest /></PrivateRoute>} />
          <Route path="/driver/incidents" element={<PrivateRoute allowedRoles={['driver']}><IncidentReport /></PrivateRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
