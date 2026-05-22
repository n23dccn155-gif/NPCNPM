import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form);
      // Điều hướng theo vai trò
      const roleRoutes = {
        admin: '/admin/users',
        manager: '/manager/routes',
        dispatcher: '/dispatcher/schedule',
        driver: '/driver/schedule',
      };
      navigate(roleRoutes[user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-2xl mb-4 border border-white/20">
            <span className="text-3xl">🚌</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Phân công xe buýt</h1>
          <p className="text-blue-200 mt-2 text-sm">TP. Hồ Chí Minh</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Đăng nhập hệ thống</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-400/50 text-red-200 rounded-xl px-4 py-3 mb-5 text-sm">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-blue-200 text-sm font-medium mb-2">Tên đăng nhập</label>
              <input
                type="text"
                id="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Nhập tên đăng nhập..."
                required
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-blue-200 text-sm font-medium mb-2">Mật khẩu</label>
              <input
                type="password"
                id="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Nhập mật khẩu..."
                required
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              id="btn-login"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-400 disabled:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 mt-2 shadow-lg hover:shadow-blue-500/30"
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          {/* Demo accounts hint */}
          <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-blue-300 text-xs font-medium mb-2">🔑 Tài khoản demo (mật khẩu: 123456)</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-blue-200">
              <span>admin → Admin</span>
              <span>manager1 → Quản lý</span>
              <span>dispatcher1 → Điều phối</span>
              <span>driver1 → Tài xế</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
