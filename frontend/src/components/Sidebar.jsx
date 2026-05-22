import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const menuByRole = {
  admin: [
    { label: 'Tài khoản', path: '/admin/users', icon: '👥' },
    { label: 'Cấu hình', path: '/admin/configurations', icon: '⚙️' },
  ],
  manager: [
    { label: 'Tuyến xe', path: '/manager/routes', icon: '🗺️' },
    { label: 'Xe buýt', path: '/manager/buses', icon: '🚌' },
    { label: 'Tài xế', path: '/manager/drivers', icon: '👤' },
    { label: 'Duyệt nghỉ', path: '/manager/leave-requests', icon: '📋' },
    { label: 'Báo cáo', path: '/manager/reports', icon: '📊' },
  ],
  dispatcher: [
    { label: 'Lịch phân công', path: '/dispatcher/schedule', icon: '📅' },
    { label: 'Chuyến xe', path: '/dispatcher/trips', icon: '🚍' },
    { label: 'Sự cố', path: '/dispatcher/incidents', icon: '⚠️' },
    { label: 'Theo dõi chuyến', path: '/dispatcher/trip-logs', icon: '📝' },
  ],
  driver: [
    { label: 'Lịch làm việc', path: '/driver/schedule', icon: '📅' },
    { label: 'Xin nghỉ', path: '/driver/leave', icon: '🌴' },
    { label: 'Báo sự cố', path: '/driver/incidents', icon: '⚠️' },
  ],
};

const roleLabel = { admin: 'Quản trị viên', manager: 'Quản lý', dispatcher: 'Điều phối viên', driver: 'Tài xế' };
const roleColor = { admin: 'bg-purple-500', manager: 'bg-green-500', dispatcher: 'bg-blue-500', driver: 'bg-orange-500' };

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;
  const menu = menuByRole[user.role] || [];

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="w-64 min-h-screen bg-gray-900 flex flex-col shadow-2xl">
      {/* Brand */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚌</span>
          <div>
            <div className="text-white font-bold text-sm leading-tight">Phân công xe buýt</div>
            <div className="text-gray-400 text-xs">TP. Hồ Chí Minh</div>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full ${roleColor[user.role]} flex items-center justify-center text-white font-bold text-sm`}>
            {user.username[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{user.username}</div>
            <div className="text-gray-400 text-xs">{roleLabel[user.role]}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menu.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-red-600/20 hover:text-red-400 text-sm transition-all duration-150"
        >
          <span>🚪</span>
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}
