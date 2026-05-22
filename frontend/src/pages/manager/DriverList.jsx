import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, ConfirmDialog, Modal, AlertBox } from '../../components/UI';
import { getDrivers, createDriver, updateDriver, updateDriverStatus } from '../../services/driverService';
import { getUsers } from '../../services/miscService';

export default function DriverList() {
  const [drivers, setDrivers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ driver_code: '', full_name: '', user_id: '' });
  const [confirm, setConfirm] = useState({ open: false, driver: null, newStatus: '' });
  const [formError, setFormError] = useState('');

  const load = async () => {
    const [driverRes, userRes] = await Promise.all([getDrivers(), getUsers()]);
    setDrivers(driverRes.data.data);
    setUsers(userRes.data.data.filter(u => u.role_name === 'driver'));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ driver_code: '', full_name: '', user_id: '' }); setFormError(''); setShowModal(true); };
  const openEdit = (d) => { setEditing(d); setForm({ driver_code: d.driver_code, full_name: d.full_name, user_id: d.user_id || '' }); setFormError(''); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setFormError('');
    try {
      const data = { ...form, user_id: form.user_id ? Number(form.user_id) : null };
      if (editing) await updateDriver(editing.driver_code, data);
      else await createDriver(data);
      setShowModal(false); load();
    } catch (err) { setFormError(err.response?.data?.message || 'Lỗi khi lưu tài xế'); }
  };

  const handleStatusChange = async () => {
    try { await updateDriverStatus(confirm.driver.driver_code, confirm.newStatus); setConfirm({ open: false, driver: null, newStatus: '' }); load(); }
    catch (err) { alert(err.response?.data?.message || 'Lỗi'); }
  };

  if (loading) return <Layout><div className="flex justify-center py-12 text-gray-500">Đang tải...</div></Layout>;

  return (
    <Layout>
      <PageHeader title="Quản lý tài xế" subtitle={`${drivers.length} tài xế`}
        action={<button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Thêm tài xế</button>} />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Mã tài xế', 'Họ tên', 'Tài khoản', 'Trạng thái', 'Thao tác'].map(h => (
                <th key={h} className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${h === 'Thao tác' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {drivers.map((d) => (
              <tr key={d.driver_code} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 font-mono font-medium text-gray-900">{d.driver_code}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{d.full_name}</td>
                <td className="px-6 py-4 text-gray-500 text-sm">{d.username || '—'}</td>
                <td className="px-6 py-4"><StatusBadge status={d.status} /></td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => openEdit(d)} className="text-blue-600 hover:text-blue-800 text-sm">Sửa</button>
                  <button onClick={() => setConfirm({ open: true, driver: d, newStatus: d.status === 'working' ? 'inactive' : 'working' })}
                    className={`text-sm ${d.status === 'working' ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}>
                    {d.status === 'working' ? 'Ngưng làm việc' : 'Kích hoạt'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {drivers.length === 0 && <div className="text-center py-12 text-gray-400">Chưa có tài xế nào</div>}
      </div>
      <Modal isOpen={showModal} title={editing ? 'Sửa tài xế' : 'Thêm tài xế'} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          {!editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã tài xế *</label>
              <input value={form.driver_code} onChange={(e) => setForm({ ...form, driver_code: e.target.value })} required placeholder="VD: TX004"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên *</label>
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Liên kết tài khoản</label>
            <select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Chọn tài khoản —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl text-sm text-gray-600">Hủy</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">Lưu</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={confirm.open} title="Xác nhận thay đổi trạng thái"
        message={`Bạn có chắc muốn thay đổi trạng thái tài xế "${confirm.driver?.full_name}" không?`}
        onConfirm={handleStatusChange} onCancel={() => setConfirm({ open: false, driver: null, newStatus: '' })} danger />
    </Layout>
  );
}
