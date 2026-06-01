import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox, Modal } from '../../components/UI';
import { getTrips, cancelTrip } from '../../services/tripService';
import { getRoutes } from '../../services/routeService';

export default function TripManage() {
  const [trips, setTrips] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [filterRoute, setFilterRoute] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  const [cancelModal, setCancelModal] = useState({ open: false, trip: null, reason: '' });
  const [cancelError, setCancelError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    const params = {};
    if (filterDate) params.date = filterDate;
    if (filterRoute) params.route_code = filterRoute;
    if (filterStatus) params.status = filterStatus;

    try {
      const [tripRes, routeRes] = await Promise.all([
        getTrips(params),
        getRoutes({ status: 'active' }),
      ]);
      setTrips(tripRes.data?.data || tripRes.data || []);
      setRoutes(routeRes.data?.data || routeRes.data || []);
    } catch (err) {
      console.error(err);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterDate, filterRoute, filterStatus]);

  const handleCancelClick = (trip) => {
    setCancelModal({ open: true, trip, reason: '' });
    setCancelError('');
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    setCancelError('');
    if (!cancelModal.reason.trim()) {
      setCancelError('Vui lòng nhập lý do hủy chuyến');
      return;
    }
    try {
      await cancelTrip(cancelModal.trip.trip_id, cancelModal.reason);
      setCancelModal({ open: false, trip: null, reason: '' });
      setSuccess('Đã hủy chuyến xe thành công.');
      setTimeout(() => setSuccess(''), 4000);
      load();
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Lỗi khi hủy chuyến xe');
    }
  };

  const statusLabel = {
    scheduled: 'Đã lên lịch',
    running: 'Đang chạy',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy'
  };

  const statusColor = {
    scheduled: 'bg-blue-50 text-blue-700',
    running: 'bg-green-50 text-green-700',
    completed: 'bg-slate-50 text-slate-700',
    cancelled: 'bg-red-50 text-red-700'
  };

  return (
    <Layout>
      <PageHeader
        title="Quản lý chuyến xe thực tế"
        subtitle="Theo dõi lộ trình, trạng thái, thời gian chạy thực tế và thực hiện hủy chuyến khẩn cấp"
      />

      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}

      {/* Filters and search */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ngày chạy:</label>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tuyến xe:</label>
          <select
            value={filterRoute}
            onChange={e => setFilterRoute(e.target.value)}
            className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả tuyến</option>
            {routes.map(r => <option key={r.route_code} value={r.route_code}>Tuyến {r.route_code} - {r.route_name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái:</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="scheduled">Đã lên lịch</option>
            <option value="running">Đang chạy</option>
            <option value="completed">Hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>
        
        {(filterDate || filterRoute || filterStatus) && (
          <button
            onClick={() => { setFilterDate(''); setFilterRoute(''); setFilterStatus(''); }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            Xóa bộ lọc
          </button>
        )}
        
        <div className="ml-auto text-xs font-bold text-slate-400">
          Tìm thấy {trips.length} chuyến xe
        </div>
      </div>

      {/* Trips list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-400 font-semibold animate-pulse">Đang tải danh sách chuyến...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['STT Chuyến', 'Nhóm chuyến', 'Hướng chạy', 'Xuất phát KH', 'Đến KH', 'Xe & Tài xế', 'Trạng thái', 'Thao tác'].map(h => (
                    <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {trips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400">
                      Không tìm thấy chuyến xe nào phù hợp
                    </td>
                  </tr>
                ) : (
                  trips.map(t => (
                    <tr key={t.trip_id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-mono font-bold text-gray-900">#{t.trip_order}</td>
                      <td className="px-6 py-4 font-bold text-slate-700">{t.group_name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${t.direction_type === 'outbound' ? 'bg-indigo-50 text-indigo-700' : 'bg-pink-50 text-pink-700'}`}>
                          {t.direction_type === 'outbound' ? 'Chiều đi' : 'Chiều về'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-semibold">
                        {new Date(t.scheduled_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        {t.actual_departure && (
                          <div className="text-2xs text-green-600 font-normal">Thực tế: {new Date(t.actual_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-semibold">
                        {new Date(t.scheduled_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        {t.actual_arrival && (
                          <div className="text-2xs text-green-600 font-normal">Thực tế: {new Date(t.actual_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="font-bold text-slate-800">Xe: {t.license_plate || '—'}</div>
                        <div className="text-slate-500 font-medium mt-0.5">Tài xế: {t.driver_name || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-bold ${statusColor[t.status] || 'bg-slate-100 text-slate-700'}`}>
                          {statusLabel[t.status] || t.status}
                          {t.delay_minutes > 0 && ` (Trễ ${t.delay_minutes}p)`}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold">
                        {t.status !== 'completed' && t.status !== 'cancelled' ? (
                          <button
                            onClick={() => handleCancelClick(t)}
                            className="text-red-600 hover:text-red-800 transition"
                          >
                            Hủy chuyến
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel Trip Modal */}
      <Modal isOpen={cancelModal.open} title="Hủy chuyến xe khẩn cấp" onClose={() => setCancelModal({ open: false, trip: null, reason: '' })}>
        {cancelModal.trip && (
          <form onSubmit={handleCancelSubmit} className="space-y-4">
            {cancelError && <AlertBox type="error" message={cancelError} />}
            
            <div className="bg-red-50 border border-red-200 text-red-700 text-2xs font-semibold rounded-xl p-3.5 leading-relaxed">
              ⚠️ CẢNH BÁO: Thao tác này sẽ hủy bỏ chuyến xe thứ #{cancelModal.trip.trip_order} thuộc nhóm "{cancelModal.trip.group_name}". Một thông báo khẩn sẽ được gửi đến tài xế được phân công chạy chuyến này.
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Lý do hủy chuyến *</label>
              <textarea
                value={cancelModal.reason}
                onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })}
                required
                rows={3}
                placeholder="Nhập lý do chi tiết hủy chuyến (VD: Xe hỏng đột xuất, tắc đường nghiêm trọng...)"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t">
              <button
                type="button"
                onClick={() => setCancelModal({ open: false, trip: null, reason: '' })}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-red-500/10 transition"
              >
                Xác nhận hủy chuyến
              </button>
            </div>
          </form>
        )}
      </Modal>
    </Layout>
  );
}
