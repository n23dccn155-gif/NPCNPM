// pages/dispatcher/TripLog.jsx — Theo dõi thực hiện chuyến (với modal ghi nhận)
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox, Modal, StatusBadge } from '../../components/UI';
import { getSchedule, createTripLog, getTripLog } from '../../services/tripService';

export default function TripLog() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [existingLog, setExistingLog] = useState(null);
  const [form, setForm] = useState({ actual_departure: '', actual_arrival: '', status: 'completed', note: '' });
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    // Only show trips that have been assigned (have assignment_status = active or replaced)
    const res = await getSchedule({ trip_date: filterDate }).catch(() => ({ data: { data: [] } }));
    const allTrips = res.data?.data || [];
    // Show all assigned trips
    setTrips(allTrips.filter(t => t.bus_id && t.driver_code));
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterDate]);

  const openLog = async (trip) => {
    setSelectedTrip(trip);
    setFormError('');
    // Try to load existing log
    try {
      const res = await getTripLog(trip.trip_code);
      const log = res.data?.data;
      if (log) {
        setExistingLog(log);
        setForm({
          actual_departure: log.actual_departure ? new Date(log.actual_departure).toTimeString().substring(0, 5) : '',
          actual_arrival: log.actual_arrival ? new Date(log.actual_arrival).toTimeString().substring(0, 5) : '',
          status: log.status || 'completed',
          note: log.note || '',
        });
      } else {
        setExistingLog(null);
        setForm({ actual_departure: '', actual_arrival: '', status: 'completed', note: '' });
      }
    } catch {
      setExistingLog(null);
      setForm({ actual_departure: '', actual_arrival: '', status: 'completed', note: '' });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    try {
      await createTripLog({
        trip_code: selectedTrip.trip_code,
        assignment_id: selectedTrip.assignment_id,
        actual_departure: form.actual_departure || null,
        actual_arrival: form.actual_arrival || null,
        status: form.status,
        note: form.note,
      });
      setShowModal(false);
      setSuccess(`Đã ghi nhận thực hiện chuyến ${selectedTrip.trip_code}`);
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Lỗi ghi nhận');
    } finally { setSaving(false); }
  };

  const logStatusLabel = { completed: 'Hoàn thành', delayed: 'Trễ giờ', cancelled: 'Đã hủy' };

  return (
    <Layout>
      <PageHeader
        title="Theo dõi thực hiện chuyến"
        subtitle="Ghi nhận thông tin thực tế của các chuyến xe đã phân công"
        action={
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        }
      />

      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}

      {/* Table — matching Figma trip-log */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-medium text-gray-700">Danh sách chuyến đã phân công</h3>
        </div>
        {loading ? (
          <div className="text-center py-16 text-gray-400">Đang tải...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {['Mã chuyến', 'Tuyến', 'Giờ dự kiến', 'Xe', 'Tài xế', 'Thao tác'].map(h => (
                  <th key={h} className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${h === 'Thao tác' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {trips.map(t => (
                <tr key={t.trip_code} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 font-mono text-sm font-semibold text-gray-900">{t.trip_code}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{t.route_code} - {t.route_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 font-mono">
                    {t.scheduled_departure?.substring(0,5)} – {t.scheduled_arrival?.substring(0,5) || '?'}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-700">{t.bus_id}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{t.driver_name || t.driver_code}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openLog(t)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium transition"
                    >
                      Nhập thực tế
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && trips.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">
            Không có chuyến nào đã phân công trong ngày {filterDate}
          </div>
        )}
      </div>

      {/* Modal ghi nhận thực hiện */}
      <Modal isOpen={showModal} title={`Ghi nhận chuyến: ${selectedTrip?.trip_code}`} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          {existingLog && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
              ⚠️ Chuyến này đã có bản ghi thực hiện. Lưu sẽ cập nhật lại.
            </div>
          )}

          {/* Trip info */}
          {selectedTrip && (
            <div className="bg-slate-50 rounded-xl p-4 text-sm grid grid-cols-2 gap-2">
              <div><span className="text-gray-500">Tuyến:</span> <span className="font-medium">{selectedTrip.route_code}</span></div>
              <div><span className="text-gray-500">Giờ DK:</span> <span className="font-medium">{selectedTrip.scheduled_departure}</span></div>
              <div><span className="text-gray-500">Xe:</span> <span className="font-medium">{selectedTrip.bus_id}</span></div>
              <div><span className="text-gray-500">Tài xế:</span> <span className="font-medium">{selectedTrip.driver_name || selectedTrip.driver_code}</span></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Giờ xuất bến thực tế
                <span className="text-gray-400 font-normal ml-1">(để trống nếu không có)</span>
              </label>
              <input
                type="time"
                value={form.actual_departure}
                onChange={e => setForm({ ...form, actual_departure: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {form.actual_departure && selectedTrip?.scheduled_departure && (
                <p className="text-xs mt-1">
                  {(() => {
                    const [sh, sm] = selectedTrip.scheduled_departure.split(':').map(Number);
                    const [ah, am] = form.actual_departure.split(':').map(Number);
                    const delay = (ah * 60 + am) - (sh * 60 + sm);
                    if (delay > 0) return <span className="text-red-500">⏱️ Trễ {delay} phút</span>;
                    if (delay < 0) return <span className="text-green-600">✅ Sớm {Math.abs(delay)} phút</span>;
                    return <span className="text-green-600">✅ Đúng giờ</span>;
                  })()}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Giờ kết thúc thực tế
                <span className="text-gray-400 font-normal ml-1">(để trống nếu không có)</span>
              </label>
              <input
                type="time"
                value={form.actual_arrival}
                onChange={e => setForm({ ...form, actual_arrival: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Trạng thái thực hiện *</label>
            <select
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="completed">Hoàn thành đúng giờ</option>
              <option value="delayed">Hoàn thành trễ</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ghi chú</label>
            <textarea
              value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
              rows={3}
              placeholder="Nhập ghi chú nếu có..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition">Hủy</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl py-2.5 text-sm font-medium transition">
              {saving ? 'Đang lưu...' : 'Lưu ghi nhận'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
