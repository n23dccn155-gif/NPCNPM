import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, ConfirmDialog, Modal, AlertBox } from '../../components/UI';
import { getBuses, createBus, updateBus, updateBusStatus } from '../../services/busService';

export default function BusList() {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ bus_id: '', license_plate: '', capacity: '' });
  const [confirm, setConfirm] = useState({ open: false, bus: null, newStatus: '' });
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = async () => { try { const res = await getBuses(); setBuses(res.data.data); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ bus_id: '', license_plate: '', capacity: '' }); setFormError(''); setShowModal(true); };
  const openEdit = (b) => { setEditing(b); setForm({ bus_id: b.bus_id, license_plate: b.license_plate, capacity: b.capacity }); setFormError(''); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setFormError('');
    try {
      if (editing) await updateBus(editing.bus_id, { license_plate: form.license_plate, capacity: Number(form.capacity) });
      else await createBus({ ...form, capacity: Number(form.capacity) });
      setShowModal(false); load();
    } catch (err) { setFormError(err.response?.data?.message || 'Lỗi khi lưu xe'); }
  };

  const handleStatusChange = async () => {
    try { await updateBusStatus(confirm.bus.bus_id, confirm.newStatus); setConfirm({ open: false, bus: null, newStatus: '' }); load(); }
    catch (err) { alert(err.response?.data?.message || 'Lỗi'); }
  };

  const statusOptions = ['active', 'broken', 'inactive'];
  const statusLabel = { active: 'Ngưng sử dụng', broken: 'Đánh dấu hỏng', inactive: 'Kích hoạt lại' };
  const nextStatus = { active: 'inactive', broken: 'active', inactive: 'active' };

  if (loading) return <Layout><div className="flex justify-center py-12 text-gray-500">Đang tải...</div></Layout>;

  const filtered = buses.filter(b => {
    const matchSearch = !search || b.bus_id.toLowerCase().includes(search.toLowerCase()) || b.license_plate.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <Layout>
      <PageHeader title="Quản lý xe buýt" subtitle={`${filtered.length} / ${buses.length} xe`}
        action={<button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">+ Thêm xe</button>} />
      {/* Tìm kiếm và lọc */}
      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo mã xe hoặc biển số..."
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="broken">Hỏng</option>
          <option value="inactive">Ngưng sử dụng</option>
        </select>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Mã xe / Biển số', 'Số chỗ', 'Trạng thái', 'Thao tác'].map(h => (
                <th key={h} className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${h === 'Thao tác' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((b) => (
              <tr key={b.bus_id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{b.bus_id}</div>
                  <div className="text-xs text-gray-500">{b.license_plate}</div>
                </td>
                <td className="px-6 py-4 text-gray-700">{b.capacity} chỗ</td>
                <td className="px-6 py-4"><StatusBadge status={b.status} /></td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => openEdit(b)} className="text-blue-600 hover:text-blue-800 text-sm">Sửa</button>
                  {b.status === 'active' && (<>
                    <button onClick={() => setConfirm({ open: true, bus: b, newStatus: 'broken' })}
                      className="text-orange-500 hover:text-orange-700 text-sm">Đánh dấu hỏng</button>
                    <button onClick={() => setConfirm({ open: true, bus: b, newStatus: 'inactive' })}
                      className="text-red-500 hover:text-red-700 text-sm">Ngưng sử dụng</button>
                  </>)}
                  {b.status === 'broken' && (
                    <button onClick={() => setConfirm({ open: true, bus: b, newStatus: 'active' })}
                      className="text-green-600 hover:text-green-800 text-sm">Kích hoạt lại</button>
                  )}
                  {b.status === 'inactive' && (
                    <button onClick={() => setConfirm({ open: true, bus: b, newStatus: 'active' })}
                      className="text-green-600 hover:text-green-800 text-sm">Kích hoạt lại</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-gray-400">Không tìm thấy xe nào</div>}
      </div>
      <Modal isOpen={showModal} title={editing ? 'Sửa xe buýt' : 'Thêm xe buýt'} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          {!editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã xe (Biển số) *</label>
              <input value={form.bus_id} onChange={(e) => setForm({ ...form, bus_id: e.target.value, license_plate: e.target.value })} required
                placeholder="Ví dụ: 51B-123.45"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số chỗ ngồi *</label>
            <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required min="1"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">Hủy</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">Lưu</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={confirm.open}
        title="Xác nhận thay đổi trạng thái xe"
        message={`Bạn có chắc muốn thay đổi trạng thái xe "${confirm.bus?.bus_id}" không?`}
        onConfirm={handleStatusChange} onCancel={() => setConfirm({ open: false, bus: null, newStatus: '' })} danger />
    </Layout>
  );
}
