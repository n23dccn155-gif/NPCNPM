import api from './api';

export const getMyNotifications = (unreadOnly = false) =>
  api.get('/notifications/my', { params: { unread_only: unreadOnly } });
export const markNotificationAsRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsAsRead = () => api.post('/notifications/read-all');
// Alias ngắn gọn, tiện dùng
export const markAsRead = markNotificationAsRead;
export const markAllRead = markAllNotificationsAsRead;
