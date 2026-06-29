import { createContext, useContext, useState, useEffect } from 'react';
import { login as loginApi, getMe } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Khôi phục session khi reload trang
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getMe()
        .then((res) => {
          // Chuẩn hoá user: đảm bảo có field `id` (number), loại bỏ `user_id` nếu có
          const u = res.data.user;
          const normalized = {
            id: u.id ?? u.user_id,
            username: u.username,
            full_name: u.full_name,
            role: u.role,
            driver_id: u.driver_id ?? null,
          };
          localStorage.setItem('user', JSON.stringify(normalized));
          setUser(normalized);
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    const res = await loginApi(credentials);
    const { token, user: userData } = res.data;
    // Đảm bảo user có field `id` (số) để SocketContext dùng cho `authenticate`.
    // Backend login trả về { id, username, full_name, role, driver_id } - không có user_id.
    const normalizedUser = {
      id: userData.id ?? userData.user_id,
      username: userData.username,
      full_name: userData.full_name,
      role: userData.role,
      driver_id: userData.driver_id ?? null,
    };
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    setUser(normalizedUser);
    return normalizedUser;
  };

  const updateUserInfo = (newData) => {
    // Đảm bảo id luôn tồn tại khi merge (ví dụ API /me trả về user_id)
    const merged = { ...user, ...newData };
    const updatedUser = {
      ...merged,
      id: merged.id ?? merged.user_id,
    };
    delete updatedUser.user_id; // tránh nhầm lẫn
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUserInfo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
