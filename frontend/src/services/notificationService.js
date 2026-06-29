import api from './api';

export const getMyNotifications = (unreadOnly = false, params = {}) =>
  api.get('/notifications/my', { params: { unread_only: unreadOnly, ...params } });
export const markNotificationAsRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsAsRead = () => api.post('/notifications/read-all');
// Alias ngắn gọn, tiện dùng
export const markAsRead = markNotificationAsRead;
export const markAllRead = markAllNotificationsAsRead;

// Lịch sử thông báo (cả đã đọc + chưa đọc) với phân trang + lọc
export const getNotificationHistory = (params = {}) =>
  api.get('/notifications/history', { params });

// Xoá 1 thông báo
export const deleteNotification = (id) => api.delete(`/notifications/${id}`);

// Xoá tất cả thông báo đã đọc
export const deleteAllReadNotifications = () => api.delete('/notifications');