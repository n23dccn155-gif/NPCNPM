import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox, Modal } from '../../components/UI';
import { createIncident, getMyIncidents } from '../../services/incidentService';
import { getMyTrips } from '../../services/tripService';
import { useAuth } from '../../context/AuthContext';

export default function IncidentReport() {
  const [incidents, setIncidents] = useState([]);
  const [myTripsToday, setMyTripsToday] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ bus_id: '', trip_id: '', incident_type: 'bus_broken', description: '' });
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [incRes, tripsRes] = await Promise.all([
        getMyIncidents(),
        getMyTrips(todayStr).catch(() => ({ data: { data: { trips: [] } } }))
      ]);
      setIncidents(incRes.data?.data || incRes.data || []);
      const tripData = tripsRes.data?.data || tripsRes.data;
      setMyTripsToday(tripData?.trips || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!user) return;

    const eventSource = new EventSource('http://localhost:5000/api/realtime/events');
    
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'INCIDENT_STATUS_UPDATED') {
          if (Number(payload.data.reporterId) === Number(user.id)) {
            const statusText = payload.data.status === 'resolved' ? 'đã giải quyết' : 'đang xử lý';
            setSuccess(`Báo cáo sự cố của bạn đã chuyển sang trạng thái: ${statusText}!`);
            setTimeout(() => setSuccess(''), 5000);
            loadData();
          }
        }
      } catch (err) {
        console.error('[Realtime] Error processing event:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[Realtime] EventSource error:', err);
    };

    return () => {
      eventSource.close();
    };
  }, [user]);

  const handleOpenModal = () => {
    // Auto-detect current active bus from today's assignments
    const activeBusId = myTripsToday[0]?.bus_id || '';
    setForm({
      bus_id: activeBusId,
      trip_id: '',
      incident_type: 'bus_broken',
      description: ''
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.description.trim()) {
      setFormError('Vui lòng nhập mô tả sự cố');
      return;
    }
    if (form.incident_type === 'bus_broken' && !form.bus_id) {
      setFormError('Vui lòng chọn xe buýt đang bị hỏng để hệ thống xử lý');
      return;
    }
    try {
      const payload = {
        incident_type: form.incident_type,
        description: form.description,
        bus_id: form.bus_id ? Number(form.bus_id) : null,
        trip_id: form.trip_id ? Number(form.trip_id) : null
      };
      await createIncident(payload);
      setShowModal(false);
      setSuccess('Báo cáo sự cố khẩn cấp đã được gửi đến ban điều hành!');
      setTimeout(() => setSuccess(''), 4000);
      loadData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Lỗi gửi báo cáo sự cố');
    }
  };

  const typeLabel = {
    bus_broken: 'Hỏng xe buýt',
    delay: 'Trễ chuyến',
    cancelled: 'Hủy chuyến',
    other: 'Sự cố khác'
  };

  const statusLabel = {
    pending: 'Đang chờ xử lý',
    processing: 'Đang giải quyết',
    resolved: 'Đã giải quyết'
  };

  const statusColor = {
    pending: 'bg-red-50 text-red-700 border-red-100',
    processing: 'bg-amber-50 text-amber-700 border-amber-100',
    resolved: 'bg-green-50 text-green-700 border-green-100'
  };

  return (
    <Layout>
      <PageHeader
        title="Báo cáo sự cố khẩn cấp"
        subtitle="Thông báo ngay khi xe gặp sự cố hỏng hóc hoặc tắc đường nghiêm trọng để điều hành hỗ trợ"
        action={
          <button
            onClick={handleOpenModal}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-red-500/10 transition"
          >
            ⚠️ Báo cáo sự cố khẩn cấp
          </button>
        }
      />

      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-bold text-gray-700">Lịch sử sự cố đã báo cáo</h3>
        </div>
        
        {loading ? (
          <div className="text-center py-16 text-slate-400 font-semibold animate-pulse">Đang tải lịch sử sự cố...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Biển số xe', 'Thứ tự chuyến', 'Loại sự cố', 'Mô tả chi tiết', 'Trạng thái'].map(h => (
                    <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                      Bạn chưa báo cáo sự cố nào
                    </td>
                  </tr>
                ) : (
                  incidents.map(i => (
                    <tr key={i.incident_id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-mono font-semibold text-gray-900">{i.license_plate || 'Không rõ'}</td>
                      <td className="px-6 py-4 font-mono text-slate-600">
                        {i.trip_order ? `Chuyến thứ #${i.trip_order}` : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-bold ${
                          i.incident_type === 'bus_broken' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {typeLabel[i.incident_type] || i.incident_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={i.description}>
                        {i.description}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-bold border ${statusColor[i.status]}`}>
                          {statusLabel[i.status] || i.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} title="Báo cáo sự cố khẩn cấp" onClose={() => setShowModal(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Xe đang chạy</label>
              <select
                value={form.bus_id}
                onChange={e => setForm({ ...form, bus_id: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Không xác định —</option>
                {myTripsToday.length > 0 && (
                  <option value={myTripsToday[0].bus_id}>
                    {myTripsToday[0].license_plate}
                  </option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Loại sự cố *</label>
              <select
                value={form.incident_type}
                onChange={e => setForm({ ...form, incident_type: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="bus_broken">Hỏng xe buýt</option>
                <option value="other">Sự cố khác (Tai nạn, tắc đường...)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Chọn chuyến bị sự cố (chỉ hiển thị hôm nay)</label>
            <select
              value={form.trip_id}
              onChange={e => setForm({ ...form, trip_id: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Chọn chuyến đi —</option>
              {myTripsToday.map(t => (
                <option key={t.trip_id} value={t.trip_id}>
                  Chuyến #{t.trip_order} ({new Date(t.scheduled_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Mô tả chi tiết *</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              required
              rows={4}
              placeholder="Nhập chi tiết địa điểm, tình hình sự cố hiện tại..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 justify-end pt-3 border-t">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-red-500/10 transition"
            >
              Gửi báo cáo sự cố
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
