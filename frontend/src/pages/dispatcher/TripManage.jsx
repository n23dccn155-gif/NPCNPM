// pages/dispatcher/TripManage.jsx — Quản lý chuyến xe (riêng biệt khỏi ScheduleOverview)
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, AlertBox, Modal } from '../../components/UI';
import { getTrips, createTrip } from '../../services/tripService';
import { getRoutes } from '../../services/routeService';

export default function TripManage() {
  const [trips, setTrips] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [filterRoute, setFilterRoute] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ trip_code: '', route_code: '', trip_date: new Date().toISOString().split('T')[0], scheduled_departure: '', direction: 'outbound', scheduled_arrival: '' });
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    const params = {};
    if (filterDate) params.trip_date = filterDate;
    if (filterRoute) params.route_code = filterRoute;
    const [tripRes, routeRes] = await Promise.all([
      getTrips(params).catch(() => ({ data: { data: [] } })),
      getRoutes({ status: 'active' }).catch(() => ({ data: { data: [] } })),
    ]);
    setTrips(tripRes.data?.data || []);
    setRoutes(routeRes.data?.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterDate, filterRoute]);

  const handleCreate = async (e) => {
    e.preventDefault(); setFormError('');
    try {
      await createTrip(form);
      setShowModal(false);
      setSuccess('Lập chuyến thành công!');
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (err) { setFormError(err.response?.data?.message || 'Lỗi lập chuyến'); }
  };

  const tripStatusColor = { unassigned: '#ea580c', assigned: '#2563eb', in_progress: '#16a34a', completed: '#64748b', delayed: '#d97706', cancelled: '#dc2626' };
  const tripStatusLabel = { unassigned: 'Chưa phân công', assigned: 'Đã phân công', in_progress: 'Đang chạy', completed: 'Hoàn thành', delayed: 'Hoàn thành trễ', cancelled: 'Đã hủy' };

  return (
    <Layout>
      <PageHeader
        title="Chuyến xe"
        subtitle="Danh sách và quản lý các chuyến xe"
        action={
          <button
            onClick={() => { setForm({ trip_code: '', route_code: '', trip_date: new Date().toISOString().split('T')[0], scheduled_departure: '', direction: 'outbound', scheduled_arrival: '' }); setFormError(''); setShowModal(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Lập chuyến mới
          </button>
        }
      />

      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium whitespace-nowrap">Ngày chạy:</label>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium whitespace-nowrap">Tuyến xe:</label>
          <select
            value={filterRoute}
            onChange={e => setFilterRoute(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả tuyến</option>
            {routes.map(r => <option key={r.route_code} value={r.route_code}>{r.route_code} - {r.route_name}</option>)}
          </select>
        </div>
        {(filterDate || filterRoute) && (
          <button
            onClick={() => { setFilterDate(''); setFilterRoute(''); }}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Xóa bộ lọc
          </button>
        )}
        <div className="ml-auto text-sm text-gray-500">{trips.length} chuyến</div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Đang tải...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Mã chuyến', 'Tuyến xe', 'Chiều chạy', 'Ngày chạy', 'Giờ chạy dự kiến', 'Trạng thái'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {trips.map(t => (
                <tr key={t.trip_code} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 font-mono text-sm font-semibold text-gray-900">{t.trip_code}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{t.route_code} - {t.route_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <span className={`px-2 py-0.5 rounded text-xs ${t.direction === 'outbound' ? 'bg-indigo-50 text-indigo-600' : 'bg-pink-50 text-pink-600'}`}>
                      {t.direction === 'outbound' ? 'Chiều đi' : 'Chiều về'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{new Date(t.trip_date).toLocaleDateString('vi-VN')}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 font-mono">{t.scheduled_departure.substring(0, 5)} - {t.scheduled_arrival?.substring(0, 5) || '—'}</td>
                  <td className="px-6 py-4">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: (tripStatusColor[t.status] || '#64748b') + '15',
                        color: tripStatusColor[t.status] || '#64748b',
                      }}
                    >
                      {tripStatusLabel[t.status] || t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && trips.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">Không có chuyến xe nào</div>
        )}
      </div>

      {/* Modal lập chuyến - matching Figma trip-form */}
      <Modal isOpen={showModal} title="Lập chuyến xe" onClose={() => setShowModal(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tuyến xe *</label>
              <select
                value={form.route_code}
                onChange={e => setForm({ ...form, route_code: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Chọn tuyến --</option>
                {routes.map(r => <option key={r.route_code} value={r.route_code}>{r.route_code} - {r.route_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ngày chạy *</label>
              <input
                type="date"
                value={form.trip_date}
                onChange={e => setForm({ ...form, trip_date: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mã chuyến *</label>
              <input
                value={form.trip_code}
                onChange={e => setForm({ ...form, trip_code: e.target.value })}
                required
                placeholder="VD: CX001"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Hướng chạy *</label>
              <select
                value={form.direction}
                onChange={e => setForm({ ...form, direction: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="outbound">Chiều đi (Outbound)</option>
                <option value="inbound">Chiều về (Inbound)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Giờ xuất bến dự kiến *</label>
              <input
                type="time"
                value={form.scheduled_departure}
                onChange={e => setForm({ ...form, scheduled_departure: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Giờ kết thúc dự kiến *</label>
              <input
                type="time"
                value={form.scheduled_arrival}
                onChange={e => setForm({ ...form, scheduled_arrival: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Hủy
            </button>
            <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>
              Lưu chuyến
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
