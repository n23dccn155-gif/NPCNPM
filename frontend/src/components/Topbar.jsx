import { useEffect, useState, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import {
  getMyNotifications,
  getNotificationHistory,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../services/notificationService';
import { toast } from 'react-toastify';

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

// Icon cho từng loại tiêu đề phổ biến — đồng bộ với NotificationHistory.jsx
const TITLE_ICON = {
  'Kế hoạch mới được tạo': '📋',
  'Sinh chuyến thành công': '🚌',
  'Kế hoạch chờ duyệt': '⏳',
  'Kế hoạch được duyệt': '✅',
  'Kế hoạch bị từ chối': '❌',
  'Phân công mới': '👤',
  'Lịch chạy xe mới': '📅',
  'Yêu cầu nghỉ phép mới': '🏖️',
  'Kết quả xin nghỉ phép': '🏖️',
  'Cảnh báo trễ chuyến': '⚠️',
  'Cảnh báo phân công': '⚠️',
  'Chuyến đã xuất bến': '🚌',
  'Chuyến hoàn thành': '🏁',
  'Hủy chuyến xe': '🚫',
  'Sự cố khẩn cấp': '🚨',
  'Cập nhật xử lý sự cố': '🔧',
  'Thay đổi lịch phân công': '🔄',
  'Lịch phân công thay thế': '🔄',
  'Thay đổi tài xế': '🔄',
  'Thay đổi xe phân công': '🔄',
  'Thay đổi xe vận hành': '🔄',
};

function guessIcon(title) {
  return TITLE_ICON[title] || '🔔';
}

function timeAgo(iso) {
  if (!iso) return '';
  const now = new Date();
  const then = new Date(iso);
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'Vừa xong';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} ngày trước`;
  try {
    return then.toLocaleString('vi-VN');
  } catch {
    return iso;
  }
}

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  // Tab trong dropdown: 'unread' | 'history'
  const [notifTab, setNotifTab] = useState('unread');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { socket } = useContext(SocketContext);

  async function loadNotifications() {
    try {
      const res = await getMyNotifications(true);
      const data = res.data?.data || res.data;
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Lỗi tải thông báo:', err);
      setNotifications([]);
    }
  }

  // Tải lịch sử thông báo (chỉ khi mở tab Lịch sử, tránh gọi thừa)
  async function loadHistory(limit = 15) {
    setHistoryLoading(true);
    try {
      const res = await getNotificationHistory({ pageSize: limit, page: 1 });
      // response shape: { success, message, data: { items, pagination, unread_count } }
      const payload = res.data?.data;
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setHistory(items);
    } catch (err) {
      console.error('Lỗi tải lịch sử thông báo:', err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  const playSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(() => {});
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Khi mở dropdown -> nếu chưa có history thì tải; nếu chuyển tab -> tải
  useEffect(() => {
    if (!showNotif) return;
    if (notifTab === 'history' && history.length === 0 && !historyLoading) {
      loadHistory(15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotif, notifTab]);

  useEffect(() => {
    if (!socket) return;
    const onNotif = (data) => {
      toast.info(`${data.title}: ${data.content}`, { position: 'top-right', autoClose: 5000 });
      playSound();
      loadNotifications();
      // Nếu dropdown đang mở tab lịch sử thì refresh lịch sử luôn
      if (showNotif && notifTab === 'history') loadHistory(15);
    };
    const onIncident = (data) => {
      toast.error(`${data.title}: ${data.content}`, { position: 'top-right', autoClose: 8000 });
      playSound();
      loadNotifications();
      if (showNotif && notifTab === 'history') loadHistory(15);
    };
    socket.on('NEW_NOTIFICATION', onNotif);
    socket.on('NEW_INCIDENT', onIncident);
    return () => {
      socket.off('NEW_NOTIFICATION', onNotif);
      socket.off('NEW_INCIDENT', onIncident);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, showNotif, notifTab]);

  const handleMarkAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.filter(n => n.notification_id !== id));
      // Đánh dấu đã đọc thì thông báo sẽ "chuyển" từ tab Chưa đọc sang tab Lịch sử
      setHistory(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n));
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
      // Sau khi đánh dấu tất cả, chuyển hết sang tab Lịch sử và load lại
      setNotifications([]);
      if (showNotif && notifTab === 'history') loadHistory(15);
      toast.success('Đã đánh dấu tất cả là đã đọc');
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return null;

  const color = roleColor[user.role] || '#2563eb';
  const initials = user.full_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || 'U';

  return (
    <header style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }} className="flex items-center justify-between px-6 py-3 z-20 relative">
      <div className="text-gray-500 font-medium text-sm">
        Xin chào, <span className="font-semibold text-gray-800">{user.full_name || user.username}</span>
      </div>

      <div className="flex items-center gap-4">
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
            <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 text-sm">
              {/* Tabs */}
              <div className="flex items-center justify-between px-4 pt-2 pb-2 border-b border-slate-100">
                <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => setNotifTab('unread')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${notifTab === 'unread'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                      }`}
                  >
                    🔔 Chưa đọc
                    {notifications.length > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                        {notifications.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setNotifTab('history')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${notifTab === 'history'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                      }`}
                  >
                    🗂 Lịch sử
                  </button>
                </div>
                <button
                  onClick={() => { setShowNotif(false); navigate('/notifications'); }}
                  className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
                  title="Xem chi tiết lịch sử thông báo"
                >
                  Mở rộng →
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto">
                {notifTab === 'unread' ? (
                  notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-xs">
                      <div className="text-3xl mb-2">📭</div>
                      Không có thông báo mới
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-50">
                        <span className="text-xs text-slate-500 font-medium">
                          {notifications.length} thông báo chưa đọc
                        </span>
                        <button
                          onClick={handleMarkAllRead}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          ✓ Đọc tất cả
                        </button>
                      </div>
                      {notifications.map((notif) => (
                        <div
                          key={notif.notification_id}
                          className="px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-b-0 flex gap-2 justify-between items-start"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-800 text-xs flex items-center gap-1.5">
                              <span>{guessIcon(notif.title)}</span>
                              <span className="truncate">{notif.title}</span>
                            </div>
                            <div className="text-gray-600 text-xs mt-1 leading-relaxed line-clamp-2">
                              {notif.content}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">
                              {timeAgo(notif.created_at)}
                            </div>
                          </div>
                          <button
                            onClick={() => handleMarkAsRead(notif.notification_id)}
                            className="text-[11px] text-blue-500 hover:text-blue-700 font-medium ml-2 flex-shrink-0"
                            title="Đánh dấu đã đọc"
                          >
                            ✓
                          </button>
                        </div>
                      ))}
                    </>
                  )
                ) : (
                  // Tab Lịch sử
                  historyLoading ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-xs">
                      Đang tải lịch sử...
                    </div>
                  ) : history.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-xs">
                      <div className="text-3xl mb-2">📜</div>
                      Chưa có lịch sử thông báo
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-2 border-b border-slate-50">
                        <span className="text-xs text-slate-500 font-medium">
                          {history.length} thông báo gần nhất
                        </span>
                      </div>
                      {history.map((notif) => (
                        <div
                          key={notif.notification_id}
                          onClick={() => { setShowNotif(false); navigate('/notifications'); }}
                          className={`px-4 py-3 border-b border-slate-50 last:border-b-0 flex gap-2 items-start cursor-pointer transition ${notif.is_read ? 'hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50'
                            }`}
                          title="Bấm để mở trang Lịch sử thông báo"
                        >
                          <span className="text-lg flex-shrink-0">{guessIcon(notif.title)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className={`font-semibold text-xs truncate ${notif.is_read ? 'text-slate-700' : 'text-slate-900'}`}>
                                {notif.title}
                              </div>
                              {!notif.is_read && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-500 text-white flex-shrink-0">
                                  MỚI
                                </span>
                              )}
                            </div>
                            <div className="text-gray-600 text-xs mt-0.5 leading-relaxed line-clamp-2">
                              {notif.content}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {timeAgo(notif.created_at)}
                              {!notif.is_read && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notif.notification_id); }}
                                  className="ml-2 text-blue-500 hover:text-blue-700 font-semibold"
                                >
                                  Đánh dấu đã đọc
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div
                        onClick={() => { setShowNotif(false); navigate('/notifications'); }}
                        className="px-4 py-2 text-center text-xs text-blue-600 hover:bg-slate-50 cursor-pointer font-semibold border-t border-slate-100"
                      >
                        Xem tất cả lịch sử →
                      </div>
                    </>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-8 bg-gray-200" />

        <button onClick={() => navigate('/profile')} className="flex items-center gap-3 hover:bg-slate-50 rounded-xl px-3 py-1.5 transition-all text-left" title="Xem hồ sơ cá nhân">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: color }}>
            {initials}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-gray-800 leading-tight">{user.full_name || user.username}</div>
            <div className="text-xs text-gray-500">{roleLabel[user.role]}</div>
          </div>
        </button>

        <div className="w-px h-8 bg-gray-200" />

        <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 font-medium transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50">
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