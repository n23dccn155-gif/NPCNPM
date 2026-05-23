import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, ConfirmDialog, Modal, AlertBox } from '../../components/UI';
import { getDrivers, createDriver, updateDriver, updateDriverStatus } from '../../services/driverService';

const LICENSE_TYPES = ['B1', 'B2', 'C', 'D', 'E', 'F'];

export default function DriverList() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ driver_code: '', full_name: '', license_type: 'E' });
  const [confirm, setConfirm] = useState({ open: false, driver: null, newStatus: '' });
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = async () => {
    getDrivers()
      .then(res => setDrivers(res.data?.data || []))
      .catch(() => setDrivers([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ driver_code: '', full_name: '', license_type: 'E' }); setFormError(''); setShowModal(true); };
  const openEdit = (d) => { setEditing(d); setForm({ driver_code: d.driver_code, full_name: d.full_name, license_type: d.license_type || 'E' }); setFormError(''); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setFormError('');
    try {
      if (editing) await updateDriver(editing.driver_code, form);
      else await createDriver(form);
      setShowModal(false); load();
    } catch (err) { setFormError(err.response?.data?.message || 'Lỗi khi lưu tài xế'); }
  };

  const handleStatusChange = async () => {
    try { await updateDriverStatus(confirm.driver.driver_code, confirm.newStatus); setConfirm({ open: false, driver: null, newStatus: '' }); load(); }
    catch (err) { alert(err.response?.data?.message || 'Lỗi'); }
  };

  if (loading) return <Layout><div className="flex justify-center py-12 text-gray-500">Đang tải...</div></Layout>;

  const filtered = drivers.filter(d => {
    const matchSearch = !search ||
      d.driver_code.toLowerCase().includes(search.toLowerCase()) ||
      d.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.phone && d.phone.includes(search));
    const matchStatus = !filterStatus || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <Layout>
      <PageHeader title="Quản lý tài xế" subtitle={`${filtered.length} / ${drivers.length} tài xế`}
        action={<button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Thêm tài xế</button>} />
      {/* Tìm kiếm và lọc */}
      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo mã, họ tên hoặc số điện thoại..."
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang làm việc</option>
          <option value="suspended">Tạm nghỉ</option>
          <option value="inactive">Ngưng làm việc</option>
        </select>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Mã tài xế', 'Họ tên', 'Loại bằng', 'Số điện thoại', 'Tài khoản', 'Trạng thái', 'Thao tác'].map(h => (
                <th key={h} className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${h === 'Thao tác' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((d) => (
              <tr key={d.driver_code} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 font-mono font-medium text-gray-900">{d.driver_code}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{d.full_name}</td>
                <td className="px-6 py-4 text-gray-600 text-sm font-medium">{d.license_type || '—'}</td>
                <td className="px-6 py-4 text-gray-600 text-sm">{d.phone || '—'}</td>
                <td className="px-6 py-4 text-gray-500 text-sm">{d.username || '—'}</td>
                <td className="px-6 py-4"><StatusBadge status={d.status} /></td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => openEdit(d)} className="text-blue-600 hover:text-blue-800 text-sm">Sửa</button>
                  {d.status === 'active' && (
                    <button onClick={() => setConfirm({ open: true, driver: d, newStatus: 'suspended' })}
                      className="text-orange-500 hover:text-orange-700 text-sm">Tạm nghỉ</button>
                  )}
                  {d.status === 'suspended' && (
                    <button onClick={() => setConfirm({ open: true, driver: d, newStatus: 'active' })}
                      className="text-green-600 hover:text-green-800 text-sm">Kích hoạt</button>
                  )}
                  {d.status !== 'inactive' && (
                    <button onClick={() => setConfirm({ open: true, driver: d, newStatus: 'inactive' })}
                      className="text-red-500 hover:text-red-700 text-sm">Ngưng làm việc</button>
                  )}
                  {d.status === 'inactive' && (
                    <button onClick={() => setConfirm({ open: true, driver: d, newStatus: 'active' })}
                      className="text-green-600 hover:text-green-800 text-sm">Kích hoạt</button>
                  )}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại bằng lái *</label>
            <select value={form.license_type} onChange={(e) => setForm({ ...form, license_type: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {LICENSE_TYPES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl text-sm text-gray-600">Hủy</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">Lưu</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={confirm.open}
        title={confirm.newStatus === 'inactive' ? 'Ngưng làm việc?' : confirm.newStatus === 'suspended' ? 'Tạm nghỉ tài xế?' : 'Kích hoạt tài xế?'}
        message={`Bạn có chắc muốn ${confirm.newStatus === 'inactive' ? 'ngưng làm việc' : confirm.newStatus === 'suspended' ? 'tạm nghỉ' : 'kích hoạt'} tài xế "${confirm.driver?.full_name}" không?`}
        onConfirm={handleStatusChange} onCancel={() => setConfirm({ open: false, driver: null, newStatus: '' })} danger={confirm.newStatus !== 'active'} />
    </Layout>
  );
}
