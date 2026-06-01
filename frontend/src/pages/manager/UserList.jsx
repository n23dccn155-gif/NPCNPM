import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, Modal, AlertBox, ConfirmDialog } from '../../components/UI';
import { getUsers, createUser, updateUserStatus } from '../../services/userService';

const ROLES = ['manager', 'dispatcher', 'driver'];
const roleLabel = { manager: 'Quản lý vận hành', dispatcher: 'Điều phối viên', driver: 'Tài xế' };

export default function UserList() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'driver', full_name: '', phone: '', license_class: 'E' });
  const [formError, setFormError] = useState('');
  const [confirm, setConfirm] = useState({ open: false, user: null, newStatus: '' });
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = () => {
    getUsers()
      .then(res => {
        setUsers(res.data.data || res.data || []);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await createUser(form);
      setShowModal(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Lỗi tạo tài khoản');
    }
  };

  const handleStatusChange = async () => {
    try {
      await updateUserStatus(confirm.user.user_id, confirm.newStatus);
      setConfirm({ open: false, user: null, newStatus: '' });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi cập nhật trạng thái');
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !filterStatus || u.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <Layout>
      <PageHeader
        title="Quản lý tài khoản hệ thống"
        subtitle={`Hiển thị ${filtered.length} / ${users.length} tài khoản người dùng`}
        action={
          <button
            onClick={() => {
              setForm({ username: '', password: '', role: 'driver', full_name: '', phone: '', license_class: 'E' });
              setFormError('');
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/10 transition-all"
          >
            + Tạo tài khoản
          </button>
        }
      />

      {/* Search and Filters */}
      <div className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo tên đăng nhập hoặc họ tên..."
          className="flex-1 border border-slate-200 bg-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-slate-200 bg-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="locked">Bị khóa</option>
        </select>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Mã ID', 'Tên đăng nhập', 'Họ và tên', 'Vai trò', 'Trạng thái', 'Thao tác'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">
                    Không tìm thấy tài khoản phù hợp
                  </td>
                </tr>
              ) : (
                filtered.map(u => (
                  <tr key={u.user_id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-gray-500 text-sm font-mono font-semibold">#{u.user_id}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{u.username}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">{u.full_name || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-semibold">{roleLabel[u.role] || u.role}</td>
                    <td className="px-6 py-4"><StatusBadge status={u.status} /></td>
                    <td className="px-6 py-4 text-sm font-semibold space-x-3">
                      {u.status === 'active' ? (
                        <button
                          onClick={() => setConfirm({ open: true, user: u, newStatus: 'locked' })}
                          className="text-red-500 hover:text-red-700 transition"
                        >
                          Khóa tài khoản
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirm({ open: true, user: u, newStatus: 'active' })}
                          className="text-green-600 hover:text-green-800 transition"
                        >
                          Mở khóa
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Account Modal */}
      <Modal isOpen={showModal} title="Tạo tài khoản mới" onClose={() => setShowModal(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Tên đăng nhập *</label>
            <input
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
              placeholder="Nhập tên đăng nhập viết liền không dấu..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Mật khẩu *</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              placeholder="Tối thiểu 6 ký tự..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Họ và tên *</label>
            <input
              value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              required
              placeholder="Nhập họ tên đầy đủ..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Vai trò *</label>
            <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            >
              {ROLES.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
            </select>
          </div>

          {form.role === 'driver' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Số điện thoại</label>
                <input
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="Nhập số điện thoại tài xế..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Hạng bằng lái *</label>
                <select
                  value={form.license_class}
                  onChange={e => setForm({ ...form, license_class: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                >
                  {['B2', 'C', 'D', 'E', 'F'].map(lc => <option key={lc} value={lc}>{lc}</option>)}
                </select>
              </div>
            </>
          )}

          <div className="flex gap-3 justify-end pt-3">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/10 transition"
            >
              Tạo tài khoản
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirm.open}
        title={confirm.newStatus === 'locked' ? 'Khóa tài khoản người dùng?' : 'Mở khóa tài khoản?'}
        message={`Bạn có chắc muốn ${confirm.newStatus === 'locked' ? 'khóa' : 'mở khóa'} tài khoản của "${confirm.user?.full_name || confirm.user?.username}"?`}
        onConfirm={handleStatusChange}
        onCancel={() => setConfirm({ open: false, user: null, newStatus: '' })}
        danger={confirm.newStatus === 'locked'}
      />
    </Layout>
  );
}
