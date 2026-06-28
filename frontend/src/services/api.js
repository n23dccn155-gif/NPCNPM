// api.js: Cấu hình Axios và interceptor JWT
import axios from 'axios';

// Đọc URL từ biến môi trường Vite. Fallback về localhost cho dev.
// Trước đây hardcode 'http://localhost:5000/api' khiến không linh hoạt khi
// đổi cổng backend hoặc deploy lên server khác. SocketContext vẫn đọc env riêng
// (vì socket.io cần URL gốc, không phải URL có /api).
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Tự động gắn JWT token vào mỗi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Nếu token hết hạn (401), xóa dữ liệu và chuyển về login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
