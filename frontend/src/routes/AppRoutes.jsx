import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Route bảo vệ: yêu cầu đăng nhập
export function PrivateRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-blue-400 font-semibold animate-pulse text-lg">Đang kết nối hệ thống...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return children;
}

// Route công khai: không vào login nếu đã đăng nhập
export function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    const roleRoutes = {
      manager: '/manager/routes',
      dispatcher: '/dispatcher/schedule',
      driver: '/driver/schedule'
    };
    return <Navigate to={roleRoutes[user.role] || '/dashboard'} replace />;
  }
  return children;
}
