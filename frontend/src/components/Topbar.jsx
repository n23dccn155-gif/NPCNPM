import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const roleLabel = {
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  dispatcher: 'Điều phối viên',
  driver: 'Tài xế',
};
const roleColor = {
  admin: '#7c3aed',
  manager: '#16a34a',
  dispatcher: '#2563eb',
  driver: '#ea580c',
};

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const goProfile = () => navigate('/profile');

  const color = roleColor[user.role] || '#2563eb';
  const initials = user.full_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || 'U';

  return (
    <header
      style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}
      className="flex items-center justify-end px-6 py-3 gap-4 z-10"
    >
      {/* Profile button */}
      <button
        onClick={goProfile}
        className="flex items-center gap-3 hover:bg-slate-50 rounded-xl px-3 py-1.5 transition-all"
        title="Xem hồ sơ cá nhân"
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: color }}
        >
          {initials}
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-sm font-semibold text-gray-800 leading-tight">{user.full_name || user.username}</div>
          <div className="text-xs text-gray-500">{roleLabel[user.role]}</div>
        </div>
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-200" />

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 font-medium transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16,17 21,12 16,7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        <span className="hidden sm:inline">Đăng xuất</span>
      </button>
    </header>
  );
}
