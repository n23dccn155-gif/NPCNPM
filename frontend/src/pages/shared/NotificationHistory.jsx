import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox, Modal, ConfirmDialog } from '../../components/UI';
import {
  getNotificationHistory,
  markAsRead,
  markAllRead,
  deleteNotification,
  deleteAllReadNotifications
} from '../../services/notificationService';
import { toast } from 'react-toastify';

// Icon nhỏ cho từng loại tiêu đề phổ biến (dựa trên title của controller)
const TITLE_ICON = {
  'Kế hoạch mới được tạo': { icon: '📋', color: '#2563eb' },
  'Sinh chuyến thành công': { icon: '🚌', color: '#16a34a' },
  'Kế hoạch chờ duyệt': { icon: '⏳', color: '#ea580c' },
  'Kế hoạch được duyệt': { icon: '✅', color: '#16a34a' },
  'Kế hoạch bị từ chối': { icon: '❌', color: '#dc2626' },
  'Phân công mới': { icon: '👤', color: '#2563eb' },
  'Lịch chạy xe mới': { icon: '📅', color: '#16a34a' },
  'Yêu cầu nghỉ phép mới': { icon: '🏖️', color: '#ea580c' },
  'Kết quả xin nghỉ phép': { icon: '🏖️', color: '#2563eb' },
  'Cảnh báo trễ chuyến': { icon: '⚠️', color: '#dc2626' },
  'Cảnh báo phân công': { icon: '⚠️', color: '#dc2626' },
  'Chuyến đã xuất bến': { icon: '🚌', color: '#16a34a' },
  'Chuyến hoàn thành': { icon: '🏁', color: '#16a34a' },
  'Hủy chuyến xe': { icon: '🚫', color: '#dc2626' },
  'Sự cố khẩn cấp': { icon: '🚨', color: '#dc2626' },
  'Cập nhật xử lý sự cố': { icon: '🔧', color: '#2563eb' },
  'Thay đổi lịch phân công': { icon: '🔄', color: '#ea580c' },
  'Lịch phân công thay thế': { icon: '🔄', color: '#ea580c' },
  'Thay đổi tài xế': { icon: '🔄', color: '#ea580c' },
  'Thay đổi xe phân công': { icon: '🔄', color: '#ea580c' },
  'Thay đổi xe vận hành': { icon: '🔄', color: '#ea580c' },
};

function guessStyle(title) {
  return TITLE_ICON[title] || { icon: '🔔', color: '#64748b' };
}

function formatDateTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  } catch {
    return iso;
  }
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
  return formatDateTime(iso);
}

export default function NotificationHistory() {
  const [data, setData] = useState({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 }, unread_count: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filter
  const [filter, setFilter] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    return {
      read: 'all',         // all | unread | read
      from: monthAgo,
      to: today,
      search: '',
      page: 1,
      pageSize: 20
    };
  });

  // Modal xem chi tiết
  const [detailItem, setDetailItem] = useState(null);

  // Confirm xoá
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmDeleteAllRead, setConfirmDeleteAllRead] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: filter.page,
        pageSize: filter.pageSize,
        read: filter.read,
      };
      if (filter.from) params.from = filter.from;
      if (filter.to) params.to = filter.to;
      if (filter.search.trim()) params.search = filter.search.trim();

      const res = await getNotificationHistory(params);
      setData(res.data.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Không thể tải lịch sử thông báo');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Khi đổi filter, về trang 1
  function updateFilter(key, value) {
    setFilter(prev => ({ ...prev, [key]: value, page: key === 'page' ? value : 1 }));
  }

  function resetFilter() {
    const today = new Date().toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    setFilter({ read: 'all', from: monthAgo, to: today, search: '', page: 1, pageSize: 20 });
  }

  async function handleMarkOneRead(id) {
    try {
      await markAsRead(id);
      toast.success('Đã đánh dấu đã đọc');
      loadHistory();
    } catch {
      toast.error('Lỗi khi cập nhật');
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllRead();
      toast.success('Đã đánh dấu tất cả là đã đọc');
      loadHistory();
    } catch {
      toast.error('Lỗi khi cập nhật');
    }
  }

  async function handleDeleteOne() {
    if (!confirmDeleteId) return;
    try {
      await deleteNotification(confirmDeleteId);
      toast.success('Đã xoá thông báo');
      setConfirmDeleteId(null);
      setDetailItem(null);
      loadHistory();
    } catch {
      toast.error('Lỗi khi xoá');
    }
  }

  async function handleDeleteAllRead() {
    try {
      const res = await deleteAllReadNotifications();
      toast.success(`Đã xoá ${res.data?.data?.deleted || ''} thông báo đã đọc`.trim());
      setConfirmDeleteAllRead(false);
      loadHistory();
    } catch {
      toast.error('Lỗi khi xoá');
    }
  }

  const { items, pagination, unread_count } = data;
  const showPager = pagination.totalPages > 1;

  return (
    <Layout>
      <PageHeader
        title="Lịch sử thông báo"
        subtitle={`Tổng cộng ${pagination.total} thông báo${unread_count > 0 ? ` • Còn ${unread_count} chưa đọc` : ''}`}
        action={
          <div className="flex gap-2">
            {unread_count > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition"
              >
                ✓ Đọc tất cả
              </button>
            )}
            <button
              onClick={() => setConfirmDeleteAllRead(true)}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
            >
              🗑️ Xoá đã đọc
            </button>
          </div>
        }
      />

      {/* Bộ lọc */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Tìm kiếm</label>
            <input
              type="text"
              value={filter.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder="Tìm trong tiêu đề / nội dung..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Trạng thái</label>
            <select
              value={filter.read}
              onChange={(e) => updateFilter('read', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả</option>
              <option value="unread">Chưa đọc</option>
              <option value="read">Đã đọc</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Từ ngày</label>
            <input
              type="date"
              value={filter.from}
              onChange={(e) => updateFilter('from', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Đến ngày</label>
            <input
              type="date"
              value={filter.to}
              onChange={(e) => updateFilter('to', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-1">
            <button
              onClick={resetFilter}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
              title="Đặt lại bộ lọc"
            >
              ↺
            </button>
          </div>
        </div>
      </div>

      {error && <div className="mb-4"><AlertBox type="error" message={error} /></div>}

      {/* Bảng dữ liệu */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">Đang tải...</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-5xl mb-3">📭</div>
            <div className="text-slate-500 font-medium">Không có thông báo nào trong khoảng thời gian này</div>
            <div className="text-slate-400 text-sm mt-1">Thử mở rộng bộ lọc hoặc chờ hệ thống gửi thông báo mới</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left w-10"></th>
                    <th className="px-4 py-3 text-left">Tiêu đề</th>
                    <th className="px-4 py-3 text-left">Nội dung</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap w-44">Thời gian</th>
                    <th className="px-4 py-3 text-left w-28">Trạng thái</th>
                    <th className="px-4 py-3 text-right w-32">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((n) => {
                    const style = guessStyle(n.title);
                    return (
                      <tr
                        key={n.notification_id}
                        onClick={() => setDetailItem(n)}
                        className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition ${!n.is_read ? 'bg-blue-50/40' : ''}`}
                      >
                        <td className="px-4 py-3 text-2xl">{style.icon}</td>
                        <td className="px-4 py-3">
                          <div className={`font-semibold ${!n.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                            {n.title}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-600 line-clamp-2 max-w-xl">{n.content}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          <div>{formatDateTime(n.created_at)}</div>
                          <div className="text-slate-400">{timeAgo(n.created_at)}</div>
                        </td>
                        <td className="px-4 py-3">
                          {n.is_read ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                              Đã đọc
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              ● Mới
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            {!n.is_read && (
                              <button
                                onClick={() => handleMarkOneRead(n.notification_id)}
                                className="px-2 py-1 text-xs rounded-md text-blue-600 hover:bg-blue-50"
                                title="Đánh dấu đã đọc"
                              >
                                ✓
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmDeleteId(n.notification_id)}
                              className="px-2 py-1 text-xs rounded-md text-red-500 hover:bg-red-50"
                              title="Xoá thông báo"
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {showPager && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50 text-sm">
                <div className="text-slate-500">
                  Trang <b className="text-slate-700">{pagination.page}</b> / {pagination.totalPages}
                  {' '}• Tổng <b className="text-slate-700">{pagination.total}</b> thông báo
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => updateFilter('page', 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    «
                  </button>
                  <button
                    onClick={() => updateFilter('page', pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ‹ Trước
                  </button>
                  <button
                    onClick={() => updateFilter('page', pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Sau ›
                  </button>
                  <button
                    onClick={() => updateFilter('page', pagination.totalPages)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal xem chi tiết */}
      <Modal isOpen={!!detailItem} title={detailItem?.title} onClose={() => setDetailItem(null)}>
        {detailItem && (
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
              <span>{formatDateTime(detailItem.created_at)}</span>
              <span>•</span>
              <span>{timeAgo(detailItem.created_at)}</span>
              <span>•</span>
              {detailItem.is_read ? (
                <span className="text-slate-500">Đã đọc</span>
              ) : (
                <span className="text-blue-600 font-semibold">Chưa đọc</span>
              )}
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-slate-800 leading-relaxed whitespace-pre-wrap">
              {detailItem.content}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              {!detailItem.is_read && (
                <button
                  onClick={() => { handleMarkOneRead(detailItem.notification_id); setDetailItem(null); }}
                  className="px-4 py-2 text-sm rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  Đánh dấu đã đọc
                </button>
              )}
              <button
                onClick={() => setConfirmDeleteId(detailItem.notification_id)}
                className="px-4 py-2 text-sm rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-medium"
              >
                🗑️ Xoá
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        title="Xoá thông báo?"
        message="Thông báo này sẽ bị xoá vĩnh viễn và không thể khôi phục."
        confirmText="Xoá"
        danger
        onConfirm={handleDeleteOne}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <ConfirmDialog
        isOpen={confirmDeleteAllRead}
        title="Xoá tất cả thông báo đã đọc?"
        message="Hành động này sẽ xoá tất cả thông báo đã đọc của bạn. Không thể hoàn tác."
        confirmText="Xoá tất cả"
        danger
        onConfirm={handleDeleteAllRead}
        onCancel={() => setConfirmDeleteAllRead(false)}
      />
    </Layout>
  );
}
