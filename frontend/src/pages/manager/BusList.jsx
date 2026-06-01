import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, ConfirmDialog, Modal, AlertBox } from '../../components/UI';
import { getBuses, createBus, updateBus, updateBusStatus } from '../../services/busService';

export default function BusList() {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ license_plate: '', seat_count: '45' });
  const [confirm, setConfirm] = useState({ open: false, bus: null, newStatus: '' });
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = async () => {
    try {
      const res = await getBuses();
      setBuses(res.data?.data || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ license_plate: '', seat_count: '45' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (b) => {
    setEditing(b);
    setForm({ license_plate: b.license_plate, seat_count: String(b.seat_count) });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      if (editing) {
        await updateBus(editing.bus_id, {
          license_plate: form.license_plate,
          seat_count: Number(form.seat_count)
        });
      } else {
        await createBus({
          license_plate: form.license_plate,
          seat_count: Number(form.seat_count)
        });
      }
      setShowModal(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Lỗi khi lưu thông tin xe buýt');
    }
  };

  const handleStatusChange = async () => {
    try {
      await updateBusStatus(confirm.bus.bus_id, confirm.newStatus);
      setConfirm({ open: false, bus: null, newStatus: '' });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi cập nhật trạng thái');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-12 text-gray-500 font-semibold">Đang tải danh sách đội xe...</div>
      </Layout>
    );
  }

  const filtered = buses.filter(b => {
    const matchSearch = !search ||
      b.license_plate.toLowerCase().includes(search.toLowerCase()) ||
      String(b.bus_id).includes(search);
    const matchStatus = !filterStatus || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <Layout>
      <PageHeader
        title="Quản lý đội xe buýt"
        subtitle={`Hiển thị ${filtered.length} / ${buses.length} xe trong danh mục`}
        action={
          <button
            onClick={openAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/10 transition"
          >
            + Thêm xe buýt
          </button>
        }
      />

      {/* Search and filter bar */}
      <div className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo biển số xe hoặc mã số ID..."
          className="flex-1 border border-slate-200 bg-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-slate-200 bg-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="broken">Báo hỏng / Sự cố</option>
          <option value="inactive">Ngưng hoạt động</option>
        </select>
      </div>

      {/* Bus list table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Mã xe ID', 'Biển số xe', 'Số lượng ghế', 'Trạng thái', 'Thao tác'].map(h => (
                  <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                    Không tìm thấy xe buýt nào phù hợp
                  </td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b.bus_id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-mono font-semibold text-gray-500">#{b.bus_id}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{b.license_plate}</td>
                    <td className="px-6 py-4 text-gray-700 font-semibold">{b.seat_count} chỗ ngồi</td>
                    <td className="px-6 py-4"><StatusBadge status={b.status} /></td>
                    <td className="px-6 py-4 text-sm font-semibold space-x-3">
                      <button onClick={() => openEdit(b)} className="text-blue-600 hover:text-blue-800 transition">Chỉnh sửa</button>
                      
                      {b.status === 'active' && (
                        <>
                          <button
                            onClick={() => setConfirm({ open: true, bus: b, newStatus: 'broken' })}
                            className="text-amber-600 hover:text-amber-800 transition"
                          >
                            Báo hỏng
                          </button>
                          <button
                            onClick={() => setConfirm({ open: true, bus: b, newStatus: 'inactive' })}
                            className="text-red-500 hover:text-red-700 transition"
                          >
                            Ngưng sử dụng
                          </button>
                        </>
                      )}
                      
                      {(b.status === 'broken' || b.status === 'inactive') && (
                        <button
                          onClick={() => setConfirm({ open: true, bus: b, newStatus: 'active' })}
                          className="text-green-600 hover:text-green-800 transition"
                        >
                          Kích hoạt lại
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

      {/* Edit/Add Modal */}
      <Modal isOpen={showModal} title={editing ? 'Cập nhật thông tin xe buýt' : 'Thêm xe buýt mới'} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Biển số xe *</label>
            <input
              value={form.license_plate}
              onChange={(e) => setForm({ ...form, license_plate: e.target.value })}
              required
              placeholder="Ví dụ: 51B-123.45..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Số chỗ ngồi *</label>
            <input
              type="number"
              value={form.seat_count}
              onChange={(e) => setForm({ ...form, seat_count: e.target.value })}
              required
              min="1"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

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
              Lưu thay đổi
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirm.open}
        title={`Xác nhận thay đổi sang "${confirm.newStatus === 'active' ? 'hoạt động' : confirm.newStatus === 'broken' ? 'báo hỏng' : 'ngưng hoạt động'}"?`}
        message={`Bạn có chắc chắn muốn cập nhật trạng thái xe buýt "${confirm.bus?.license_plate}" không?`}
        onConfirm={handleStatusChange}
        onCancel={() => setConfirm({ open: false, bus: null, newStatus: '' })}
        danger={confirm.newStatus !== 'active'}
      />
    </Layout>
  );
}
