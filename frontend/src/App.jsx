import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute, PublicRoute } from './routes/AppRoutes';

// Pages
import Login from './pages/auth/Login';

// Shared
import Dashboard from './pages/shared/Dashboard';
import Profile from './pages/shared/Profile';

// Admin
import UserList from './pages/admin/UserList';
import Configuration from './pages/admin/Configuration';
import ConfigRingPage from './pages/admin/ConfigRingPage';

// Manager
import RouteList from './pages/manager/RouteList';
import BusList from './pages/manager/BusList';
import DriverList from './pages/manager/DriverList';
import LeaveApproval from './pages/manager/LeaveApproval';
import Reports from './pages/manager/Reports';

// Dispatcher
import AutoSchedulerPage from './pages/dispatcher/AutoSchedulerPage';
import TripManage from './pages/dispatcher/TripManage';
import AffectedTrips from './pages/dispatcher/AffectedTrips';
import IncidentManage from './pages/dispatcher/IncidentManage';
import TripLog from './pages/dispatcher/TripLog';

// Driver
import MyAssignmentsPage from './pages/driver/MyAssignmentsPage';
import LeaveRequest from './pages/driver/LeaveRequest';
import IncidentReport from './pages/driver/IncidentReport';

const ALL_ROLES = ['admin', 'manager', 'dispatcher', 'driver'];

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

          {/* Admin Routes */}
          <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
          <Route path="/admin/users" element={<PrivateRoute allowedRoles={['admin']}><UserList /></PrivateRoute>} />
          <Route path="/admin/configurations" element={<PrivateRoute allowedRoles={['admin']}><Configuration /></PrivateRoute>} />
          <Route path="/admin/config" element={<PrivateRoute allowedRoles={['admin']}><ConfigRingPage /></PrivateRoute>} />

          {/* Manager Routes */}
          <Route path="/manager/routes" element={<PrivateRoute allowedRoles={['manager']}><RouteList /></PrivateRoute>} />
          <Route path="/manager/buses" element={<PrivateRoute allowedRoles={['manager']}><BusList /></PrivateRoute>} />
          <Route path="/manager/drivers" element={<PrivateRoute allowedRoles={['manager']}><DriverList /></PrivateRoute>} />
          <Route path="/manager/leave-requests" element={<PrivateRoute allowedRoles={['manager']}><LeaveApproval /></PrivateRoute>} />
          <Route path="/manager/reports" element={<PrivateRoute allowedRoles={['manager']}><Reports /></PrivateRoute>} />

          {/* Dispatcher Routes */}
          <Route path="/dispatcher/schedule" element={<PrivateRoute allowedRoles={['dispatcher', 'admin', 'manager']}><AutoSchedulerPage /></PrivateRoute>} />
          <Route path="/dispatcher/trips" element={<PrivateRoute allowedRoles={['dispatcher']}><TripManage /></PrivateRoute>} />
          <Route path="/dispatcher/affected-trips" element={<PrivateRoute allowedRoles={['dispatcher']}><AffectedTrips /></PrivateRoute>} />
          <Route path="/dispatcher/incidents" element={<PrivateRoute allowedRoles={['dispatcher']}><IncidentManage /></PrivateRoute>} />
          <Route path="/dispatcher/trip-logs" element={<PrivateRoute allowedRoles={['dispatcher']}><TripLog /></PrivateRoute>} />

          {/* Driver Routes */}
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
