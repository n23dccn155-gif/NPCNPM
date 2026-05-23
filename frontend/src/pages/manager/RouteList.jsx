import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, ConfirmDialog, Modal, AlertBox } from '../../components/UI';
import { getRoutes, createRoute, updateRoute, updateRouteStatus } from '../../services/routeService';

export default function RouteList() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ route_code: '', route_name: '', start_point: '', end_point: '', estimated_minutes: '' });
  const [confirm, setConfirm] = useState({ open: false, route: null, newStatus: '' });
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = async () => {
    try {
      const res = await getRoutes();
      setRoutes(res.data.data);
    } catch { setError('Không thể tải danh sách tuyến xe'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ route_code: '', route_name: '', start_point: '', end_point: '', estimated_minutes: '' }); setFormError(''); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({ route_code: r.route_code, route_name: r.route_name, start_point: r.start_point || '', end_point: r.end_point || '', estimated_minutes: r.estimated_minutes || '' }); setFormError(''); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      if (editing) await updateRoute(editing.route_code, { route_name: form.route_name, start_point: form.start_point, end_point: form.end_point, estimated_minutes: form.estimated_minutes });
      else await createRoute(form);
      setShowModal(false);
      load();
    } catch (err) { setFormError(err.response?.data?.message || 'Lỗi khi lưu tuyến xe'); }
  };

  const handleStatusChange = async () => {
    try {
      await updateRouteStatus(confirm.route.route_code, confirm.newStatus);
      setConfirm({ open: false, route: null, newStatus: '' });
      load();
    } catch (err) { alert(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái'); }
  };

  if (loading) return <Layout><div className="flex justify-center py-12 text-gray-500">Đang tải...</div></Layout>;

  const filtered = routes.filter(r => {
    const matchSearch = !search || r.route_code.toLowerCase().includes(search.toLowerCase()) || r.route_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <Layout>
      <PageHeader
        title="Quản lý tuyến xe"
        subtitle={`${filtered.length} / ${routes.length} tuyến`}
        action={
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2">
            + Thêm tuyến
          </button>
        }
      />
      {error && <AlertBox type="error" message={error} />}
      {/* Tìm kiếm và lọc */}
      <div className="flex gap-3 mb-4">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo mã tuyến hoặc tên tuyến..."
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Ngưng hoạt động</option>
        </select>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã tuyến</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên tuyến</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Điểm đầu</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Điểm cuối</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thời gian dự kiến</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((r) => (
              <tr key={r.route_code} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 font-mono font-medium text-gray-900">{r.route_code}</td>
                <td className="px-6 py-4 text-gray-700">{r.route_name}</td>
                <td className="px-6 py-4 text-gray-600 text-sm">{r.start_point}</td>
                <td className="px-6 py-4 text-gray-600 text-sm">{r.end_point}</td>
                <td className="px-6 py-4 text-gray-600 text-sm">{r.estimated_minutes} phút</td>
                <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => openEdit(r)} className="text-blue-600 hover:text-blue-800 text-sm mr-3">Sửa</button>
                  <button
                    onClick={() => setConfirm({ open: true, route: r, newStatus: r.status === 'active' ? 'inactive' : 'active' })}
                    className={`text-sm ${r.status === 'active' ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}
                  >
                    {r.status === 'active' ? 'Ngưng' : 'Kích hoạt'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-gray-400">Không tìm thấy tuyến xe nào</div>}
      </div>

      {/* Modal thêm/sửa */}
      <Modal isOpen={showModal} title={editing ? 'Sửa tuyến xe' : 'Thêm tuyến xe'} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          {!editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã tuyến *</label>
              <input value={form.route_code} onChange={(e) => setForm({ ...form, route_code: e.target.value })} required
                placeholder="Ví dụ: 01, 08, 150..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên tuyến *</label>
            <input value={form.route_name} onChange={(e) => setForm({ ...form, route_name: e.target.value })} required
              placeholder="Ví dụ: Bến Thành - Chợ Lớn..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Điểm đầu *</label>
            <input value={form.start_point} onChange={(e) => setForm({ ...form, start_point: e.target.value })} required
              placeholder="Ví dụ: Bến Thành..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Điểm cuối *</label>
            <input value={form.end_point} onChange={(e) => setForm({ ...form, end_point: e.target.value })} required
              placeholder="Ví dụ: Chợ Lớn..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian chạy dự kiến (phút) *</label>
            <input type="number" value={form.estimated_minutes} onChange={(e) => setForm({ ...form, estimated_minutes: e.target.value })} required min="1"
              placeholder="Ví dụ: 45, 90..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">Hủy</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">Lưu</button>
          </div>
        </form>
      </Modal>

      {/* Confirm dialog */}
      <ConfirmDialog
        isOpen={confirm.open}
        title={confirm.newStatus === 'inactive' ? 'Ngưng hoạt động tuyến?' : 'Kích hoạt tuyến?'}
        message={`Bạn có chắc muốn ${confirm.newStatus === 'inactive' ? 'ngưng hoạt động' : 'kích hoạt'} tuyến "${confirm.route?.route_name}" không?`}
        onConfirm={handleStatusChange}
        onCancel={() => setConfirm({ open: false, route: null, newStatus: '' })}
        danger={confirm.newStatus === 'inactive'}
      />
    </Layout>
  );
}
