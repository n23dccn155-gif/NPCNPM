import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getMyNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../services/notificationService';

const roleLabel = {
  manager: 'Quản lý vận hành',
  dispatcher: 'Điều phối viên',
  driver: 'Tài xế xe buýt',
};

const roleColor = {
  manager: '#16a34a',
  dispatcher: '#2563eb',
  driver: '#ea580c',
};

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);

  async function loadNotifications() {
    try {
      const res = await getMyNotifications(true); // Chỉ lấy chưa đọc
      setNotifications(res.data?.data || res.data || []);
    } catch (err) {
      console.error('Lỗi tải thông báo:', err);
    }
  }

  useEffect(() => {
    if (user) {
      loadNotifications();
      // Polling notifications every 30 seconds
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleMarkAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.filter(n => n.notification_id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      await markNotificationAsRead(notif.notification_id);
      setNotifications(prev => prev.filter(n => n.notification_id !== notif.notification_id));
      setShowNotif(false);
      if (notif.redirect_url) {
        navigate(notif.redirect_url);
      }
    } catch (err) {
      console.error('Lỗi khi click thông báo:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications([]);
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return null;

  const color = roleColor[user.role] || '#2563eb';
  const initials = user.full_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || 'U';

  return (
    <header
      style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}
      className="flex items-center justify-between px-6 py-3 z-20 relative"
    >
      <div className="text-gray-500 font-medium text-sm">
        Xin chào, <span className="font-semibold text-gray-800">{user.full_name || user.username}</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="p-2 hover:bg-slate-100 rounded-xl relative transition-all"
            title="Thông báo"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                {notifications.length}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 text-sm">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                <span className="font-bold text-gray-800">Thông báo mới</span>
                {notifications.length > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    Đọc tất cả
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-gray-400 text-xs">
                    Không có thông báo mới
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.notification_id}
                      onClick={() => handleNotificationClick(notif)}
                      className="px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-b-0 flex gap-2 justify-between items-start cursor-pointer transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800 text-xs">{notif.title}</div>
                        <div className="text-gray-600 text-xs mt-1 leading-relaxed">{notif.content}</div>
                        <div className="text-[10px] text-gray-400 mt-1">
                          {new Date(notif.created_at).toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(notif.notification_id);
                        }}
                        className="text-[11px] text-blue-500 hover:text-blue-700 font-medium ml-2 flex-shrink-0"
                      >
                        Đã đọc
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200" />

        {/* Profile Info */}
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-3 hover:bg-slate-50 rounded-xl px-3 py-1.5 transition-all text-left"
          title="Xem hồ sơ cá nhân"
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: color }}
          >
            {initials}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-gray-800 leading-tight">
              {user.full_name || user.username}
            </div>
            <div className="text-xs text-gray-500">{roleLabel[user.role]}</div>
          </div>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200" />

        {/* Logout */}
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 font-medium transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16,17 21,12 16,7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>
    </header>
  );
}
