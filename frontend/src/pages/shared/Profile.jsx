import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { changePassword, updateProfile } from '../../services/miscService';

const roleLabel = { admin: 'Quản trị viên', manager: 'Quản lý', dispatcher: 'Điều phối viên', driver: 'Tài xế' };
const roleColor = {
  admin: { bg: '#7c3aed15', text: '#7c3aed' },
  manager: { bg: '#16a34a15', text: '#16a34a' },
  dispatcher: { bg: '#2563eb15', text: '#2563eb' },
  driver: { bg: '#ea580c15', text: '#ea580c' },
};

export default function Profile() {
  const { user, updateUserInfo } = useAuth();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (user) {
      setProfileForm({ full_name: user.full_name || '', phone: user.phone || '' });
    }
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError(''); setProfileSuccess('');
    setProfileLoading(true);
    try {
      const res = await updateProfile(profileForm);
      setProfileSuccess('Cập nhật thông tin cá nhân thành công!');
      updateUserInfo(res.data.data);
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Cập nhật thất bại');
    } finally { setProfileLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (form.new_password !== form.confirm_password) {
      setError('Mật khẩu mới và xác nhận không khớp'); return;
    }
    if (form.new_password.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự'); return;
    }
    setLoading(true);
    try {
      await changePassword({ current_password: form.current_password, new_password: form.new_password });
      setSuccess('Đổi mật khẩu thành công!');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally { setLoading(false); }
  };

  if (!user) return null;
  const color = roleColor[user.role] || roleColor.dispatcher;

  return (
    <Layout>
      <PageHeader title="Thông tin cá nhân" subtitle="Xem thông tin tài khoản và đổi mật khẩu" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Info Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-5">Thông tin tài khoản</h2>
          {profileSuccess && <div className="mb-4"><AlertBox type="success" message={profileSuccess} /></div>}
          {profileError && <div className="mb-4"><AlertBox type="error" message={profileError} /></div>}
          
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0"
              style={{ background: color.bg, color: color.text }}
            >
              {user.full_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-gray-900 text-lg">{user.full_name || user.username}</div>
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold mt-1"
                style={{ background: color.bg, color: color.text }}
              >
                {roleLabel[user.role]}
              </span>
            </div>
          </div>
          
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tên đăng nhập</label>
              <input
                type="text"
                value={user.username}
                disabled
                className="w-full border border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên *</label>
              <input
                type="text"
                value={profileForm.full_name}
                onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
                required
                placeholder="Nhập họ và tên..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Số điện thoại</label>
              <input
                type="text"
                value={profileForm.phone}
                onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                placeholder="Nhập số điện thoại..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Vai trò</label>
              <input
                type="text"
                value={roleLabel[user.role]}
                disabled
                className="w-full border border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
              />
            </div>
            <button
              type="submit"
              disabled={profileLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
            >
              {profileLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-5">Đổi mật khẩu</h2>
          {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}
          {error && <div className="mb-4"><AlertBox type="error" message={error} /></div>}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu hiện tại *</label>
              <input
                type="password"
                value={form.current_password}
                onChange={e => setForm({ ...form, current_password: e.target.value })}
                required
                placeholder="Nhập mật khẩu hiện tại..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu mới *</label>
              <input
                type="password"
                value={form.new_password}
                onChange={e => setForm({ ...form, new_password: e.target.value })}
                required
                placeholder="Tối thiểu 6 ký tự..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Xác nhận mật khẩu mới *</label>
              <input
                type="password"
                value={form.confirm_password}
                onChange={e => setForm({ ...form, confirm_password: e.target.value })}
                required
                placeholder="Nhập lại mật khẩu mới..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
            >
              {loading ? 'Đang lưu...' : 'Đổi mật khẩu'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
