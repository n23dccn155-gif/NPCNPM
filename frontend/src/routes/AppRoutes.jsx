import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Route bảo vệ: yêu cầu đăng nhập
export function PrivateRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-500">Đang khởi động...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return children;
}

// Route công khai: không vào login nếu đã đăng nhập
export function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    const roleRoutes = { admin: '/admin/users', manager: '/manager/routes', dispatcher: '/dispatcher/schedule', driver: '/driver/schedule' };
    return <Navigate to={roleRoutes[user.role] || '/'} replace />;
  }
  return children;
}
