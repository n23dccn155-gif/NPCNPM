import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, ConfirmDialog, Modal, AlertBox } from '../../components/UI';
import { getDrivers, updateDriver, updateDriverStatus } from '../../services/driverService';

const LICENSE_CLASSES = ['B2', 'C', 'D', 'E', 'F'];

export default function DriverList() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ full_name: '', phone: '', license_class: 'E' });
  const [confirm, setConfirm] = useState({ open: false, driver: null, newStatus: '' });
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = async () => {
    setLoading(true);
    getDrivers()
      .then(res => {
        setDrivers(res.data?.data || res.data || []);
      })
      .catch(err => {
        console.error(err);
        setDrivers([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openEdit = (d) => {
    setEditing(d);
    setForm({
      full_name: d.full_name,
      phone: d.phone || '',
      license_class: d.license_class || 'E'
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      if (editing) {
        await updateDriver(editing.driver_id, form);
        setShowModal(false);
        load();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Lỗi khi lưu tài xế');
    }
  };

  const handleStatusChange = async () => {
    try {
      await updateDriverStatus(confirm.driver.driver_id, confirm.newStatus);
      setConfirm({ open: false, driver: null, newStatus: '' });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi cập nhật trạng thái');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-12 text-gray-500 font-semibold">Đang tải danh sách tài xế...</div>
      </Layout>
    );
  }

  const filtered = drivers.filter(d => {
    const matchSearch = !search ||
      d.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.phone && d.phone.includes(search)) ||
      (d.username && d.username.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !filterStatus || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusLabel = {
    working: 'Đang làm việc',
    on_leave: 'Nghỉ phép',
    inactive: 'Ngưng làm việc'
  };

  return (
    <Layout>
      <PageHeader
        title="Quản lý đội ngũ tài xế"
        subtitle={`Hiển thị ${filtered.length} / ${drivers.length} tài xế trong hệ thống`}
        action={
          <div className="text-sm text-slate-500 italic font-medium">
            * Thêm tài xế mới bằng cách tạo tài khoản hệ thống với vai trò "Tài xế"
          </div>
        }
      />

      {/* Filter and search */}
      <div className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo họ tên, số điện thoại hoặc tài khoản..."
          className="flex-1 border border-slate-200 bg-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-slate-200 bg-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="working">Đang làm việc (working)</option>
          <option value="on_leave">Nghỉ phép (on_leave)</option>
          <option value="inactive">Ngưng làm việc (inactive)</option>
        </select>
      </div>

      {/* Driver table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Mã tài xế ID', 'Họ và tên', 'Tên đăng nhập', 'Số điện thoại', 'Hạng bằng lái', 'Trạng thái', 'Thao tác'].map(h => (
                  <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                    Không tìm thấy tài xế nào
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.driver_id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-mono font-semibold text-gray-500">#TX-{d.driver_id}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{d.full_name}</td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{d.username}</td>
                    <td className="px-6 py-4 text-gray-600 font-semibold">{d.phone || '—'}</td>
                    <td className="px-6 py-4 font-bold text-blue-600 bg-blue-50/50 px-2.5 py-0.5 rounded-lg inline-block my-3">{d.license_class}</td>
                    <td className="px-6 py-4"><StatusBadge status={d.status} /></td>
                    <td className="px-6 py-4 text-sm font-semibold space-x-3">
                      <button onClick={() => openEdit(d)} className="text-blue-600 hover:text-blue-800 transition">Chỉnh sửa</button>
                      
                      {d.status === 'working' && (
                        <>
                          <button
                            onClick={() => setConfirm({ open: true, driver: d, newStatus: 'on_leave' })}
                            className="text-amber-600 hover:text-amber-800 transition"
                          >
                            Tạm nghỉ
                          </button>
                          <button
                            onClick={() => setConfirm({ open: true, driver: d, newStatus: 'inactive' })}
                            className="text-red-500 hover:text-red-700 transition"
                          >
                            Ngưng làm việc
                          </button>
                        </>
                      )}

                      {d.status === 'on_leave' && (
                        <>
                          <button
                            onClick={() => setConfirm({ open: true, driver: d, newStatus: 'working' })}
                            className="text-green-600 hover:text-green-800 transition"
                          >
                            Đi làm lại
                          </button>
                          <button
                            onClick={() => setConfirm({ open: true, driver: d, newStatus: 'inactive' })}
                            className="text-red-500 hover:text-red-700 transition"
                          >
                            Ngưng làm việc
                          </button>
                        </>
                      )}

                      {d.status === 'inactive' && (
                        <button
                          onClick={() => setConfirm({ open: true, driver: d, newStatus: 'working' })}
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

      {/* Edit Modal */}
      <Modal isOpen={showModal} title="Sửa thông tin tài xế" onClose={() => setShowModal(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Họ và tên *</label>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
              placeholder="Nhập họ và tên..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Số điện thoại</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Nhập số điện thoại di động..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Hạng bằng lái *</label>
            <select
              value={form.license_class}
              onChange={(e) => setForm({ ...form, license_class: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            >
              {LICENSE_CLASSES.map(lc => <option key={lc} value={lc}>{lc}</option>)}
            </select>
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
        title="Xác nhận thay đổi trạng thái tài xế"
        message={`Bạn có chắc chắn muốn thay đổi trạng thái của tài xế "${confirm.driver?.full_name}" sang "${statusLabel[confirm.newStatus]}" không?`}
        onConfirm={handleStatusChange}
        onCancel={() => setConfirm({ open: false, driver: null, newStatus: '' })}
        danger={confirm.newStatus === 'inactive'}
      />
    </Layout>
  );
}
