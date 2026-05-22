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
  const [form, setForm] = useState({ route_code: '', route_name: '' });
  const [confirm, setConfirm] = useState({ open: false, route: null, newStatus: '' });
  const [formError, setFormError] = useState('');

  const load = async () => {
    try {
      const res = await getRoutes();
      setRoutes(res.data.data);
    } catch { setError('Không thể tải danh sách tuyến xe'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ route_code: '', route_name: '' }); setFormError(''); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({ route_code: r.route_code, route_name: r.route_name }); setFormError(''); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      if (editing) await updateRoute(editing.route_code, { route_name: form.route_name });
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

  return (
    <Layout>
      <PageHeader
        title="Quản lý tuyến xe"
        subtitle={`${routes.length} tuyến`}
        action={
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2">
            + Thêm tuyến
          </button>
        }
      />
      {error && <AlertBox type="error" message={error} />}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã tuyến</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên tuyến</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {routes.map((r) => (
              <tr key={r.route_code} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 font-mono font-medium text-gray-900">{r.route_code}</td>
                <td className="px-6 py-4 text-gray-700">{r.route_name}</td>
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
        {routes.length === 0 && <div className="text-center py-12 text-gray-400">Chưa có tuyến xe nào</div>}
      </div>

      {/* Modal thêm/sửa */}
      <Modal isOpen={showModal} title={editing ? 'Sửa tuyến xe' : 'Thêm tuyến xe'} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          {!editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã tuyến *</label>
              <input value={form.route_code} onChange={(e) => setForm({ ...form, route_code: e.target.value })} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên tuyến *</label>
            <input value={form.route_name} onChange={(e) => setForm({ ...form, route_name: e.target.value })} required
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
