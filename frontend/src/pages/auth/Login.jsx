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
      await login(form);
      // Điều hướng đến trang tổng quan sau khi đăng nhập
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative p-4 bg-slate-900">
      {/* Background Image */}
      <div className="absolute inset-0 bg-[url('/image_f2a7eb.png')] bg-cover bg-center bg-no-repeat"></div>
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg border border-white/20">
            <span className="text-3xl">🚌</span>
          </div>
          <h1 className="text-3xl font-bold text-white drop-shadow-md">Phân công xe buýt</h1>
          <p className="text-slate-200 mt-2 text-sm drop-shadow">TP. Hồ Chí Minh</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-2xl shadow-black/40 p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6 text-center">Đăng nhập hệ thống</h2>

          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 rounded-md px-4 py-3 mb-5 text-sm">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5">Tên đăng nhập</label>
              <input
                type="text"
                id="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Nhập tên đăng nhập..."
                required
                className="w-full bg-white border border-slate-300 rounded-md px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5">Mật khẩu</label>
              <input
                type="password"
                id="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Nhập mật khẩu..."
                required
                className="w-full bg-white border border-slate-300 rounded-md px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>

            <button
              type="submit"
              id="btn-login"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-md transition-all duration-200 mt-4 shadow-sm hover:shadow-md"
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          {/* Demo accounts hint */}
          <div className="mt-6 p-4 bg-slate-50 rounded-md border border-slate-200">
            <p className="text-slate-700 text-sm font-semibold mb-3">🔑 Tài khoản demo (mật khẩu: 123456)</p>
            <div className="grid grid-cols-2 gap-y-2 text-sm text-slate-500">
              <div className="font-mono text-slate-700 font-medium">manager1</div>
              <div className="text-right">Quản lý</div>
              
              <div className="font-mono text-slate-700 font-medium">dispatcher1</div>
              <div className="text-right">Điều phối</div>
              
              <div className="font-mono text-slate-700 font-medium">driver1</div>
              <div className="text-right">Tài xế</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
