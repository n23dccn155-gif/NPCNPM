// pages/admin/UserList.jsx — Quản lý tài khoản
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, Modal, AlertBox, ConfirmDialog } from '../../components/UI';
import { getUsers, createUser, updateUserStatus } from '../../services/miscService';

const ROLES = [{ id: 1, name: 'admin' }, { id: 2, name: 'manager' }, { id: 3, name: 'dispatcher' }, { id: 4, name: 'driver' }];
const roleLabel = { admin: 'Quản trị viên', manager: 'Quản lý', dispatcher: 'Điều phối viên', driver: 'Tài xế' };

export default function UserList() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role_id: 4 });
  const [formError, setFormError] = useState('');
  const [confirm, setConfirm] = useState({ open: false, user: null, newStatus: '' });

  const load = () => getUsers().then(res => setUsers(res.data.data));
  useEffect(() => { load(); }, []);

  const handleSave = async (e) => {
    e.preventDefault(); setFormError('');
    try { await createUser({ ...form, role_id: Number(form.role_id) }); setShowModal(false); load(); }
    catch (err) { setFormError(err.response?.data?.message || 'Lỗi tạo tài khoản'); }
  };

  const handleStatusChange = async () => {
    try { await updateUserStatus(confirm.user.id, confirm.newStatus); setConfirm({ open: false, user: null, newStatus: '' }); load(); }
    catch (err) { alert(err.response?.data?.message || 'Lỗi'); }
  };

  return (
    <Layout>
      <PageHeader title="Quản lý tài khoản" subtitle={`${users.length} tài khoản`}
        action={<button onClick={() => { setForm({ username: '', password: '', role_id: 4 }); setFormError(''); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Tạo tài khoản</button>} />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['#', 'Tên đăng nhập', 'Vai trò', 'Trạng thái', 'Ngày tạo', 'Thao tác'].map(h => (
                <th key={h} className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${h === 'Thao tác' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-gray-500 text-sm">{u.id}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{u.username}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{roleLabel[u.role_name] || u.role_name}</td>
                <td className="px-6 py-4"><StatusBadge status={u.status} /></td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => setConfirm({ open: true, user: u, newStatus: u.status === 'active' ? 'inactive' : 'active' })}
                    className={`text-sm ${u.status === 'active' ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}>
                    {u.status === 'active' ? 'Khóa' : 'Mở khóa'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal isOpen={showModal} title="Tạo tài khoản mới" onClose={() => setShowModal(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập *</label>
            <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu *</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò *</label>
            <select value={form.role_id} onChange={e => setForm({ ...form, role_id: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ROLES.map(r => <option key={r.id} value={r.id}>{roleLabel[r.name]}</option>)}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl text-sm text-gray-600">Hủy</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">Tạo tài khoản</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={confirm.open} title="Thay đổi trạng thái tài khoản"
        message={`Bạn có chắc muốn ${confirm.newStatus === 'inactive' ? 'khóa' : 'mở khóa'} tài khoản "${confirm.user?.username}"?`}
        onConfirm={handleStatusChange} onCancel={() => setConfirm({ open: false, user: null, newStatus: '' })} danger={confirm.newStatus === 'inactive'} />
    </Layout>
  );
}
