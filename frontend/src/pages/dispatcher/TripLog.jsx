// pages/dispatcher/TripLog.jsx — Ghi nhận thực hiện chuyến
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, Modal, AlertBox } from '../../components/UI';
import { getTripLogs, createTripLog } from '../../services/tripService';
import { getSchedule } from '../../services/tripService';

export default function TripLog() {
  const [logs, setLogs] = useState([]);
  const [trips, setTrips] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ trip_code: '', assignment_id: '', actual_departure: '', status: 'completed' });
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    const [logRes, schedRes] = await Promise.all([getTripLogs(), getSchedule()]);
    setLogs(logRes.data.data);
    setTrips(schedRes.data.data.filter(s => s.assignment_status === 'active'));
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setFormError('');
    const selectedTrip = trips.find(t => t.trip_code === form.trip_code);
    try {
      await createTripLog({ ...form, assignment_id: Number(form.assignment_id) });
      setShowModal(false); setSuccess('Đã ghi nhận thực hiện chuyến!');
      load(); setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setFormError(err.response?.data?.message || 'Lỗi ghi nhận'); }
  };

  return (
    <Layout>
      <PageHeader title="Theo dõi thực hiện chuyến" subtitle="Ghi nhận giờ xuất bến thực tế"
        action={<button onClick={() => { setForm({ trip_code: '', assignment_id: '', actual_departure: '', status: 'completed' }); setFormError(''); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Ghi nhận chuyến</button>} />
      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Mã chuyến', 'Tuyến', 'Ngày', 'Giờ dự kiến', 'Giờ thực tế', 'Trễ (phút)', 'Trạng thái'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-sm font-medium">{l.trip_code}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{l.route_code}</td>
                <td className="px-6 py-4 text-sm">{l.trip_date}</td>
                <td className="px-6 py-4 text-sm">{l.scheduled_departure}</td>
                <td className="px-6 py-4 text-sm">{l.actual_departure || '—'}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={l.delay_minutes > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                    {l.delay_minutes > 0 ? `+${l.delay_minutes}` : '0'}
                  </span>
                </td>
                <td className="px-6 py-4"><StatusBadge status={l.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div className="text-center py-12 text-gray-400">Chưa có bản ghi nào</div>}
      </div>
      <Modal isOpen={showModal} title="Ghi nhận thực hiện chuyến" onClose={() => setShowModal(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chuyến xe *</label>
            <select value={form.trip_code}
              onChange={e => {
                const t = trips.find(tr => tr.trip_code === e.target.value);
                setForm({ ...form, trip_code: e.target.value, assignment_id: t ? '' : '' });
              }}
              required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Chọn chuyến đã có phân công —</option>
              {trips.map(t => <option key={t.trip_code} value={t.trip_code}>{t.trip_code} | {t.route_code} | {t.trip_date} {t.scheduled_departure}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Giờ xuất bến thực tế</label>
            <input type="time" value={form.actual_departure} onChange={e => setForm({ ...form, actual_departure: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Hủy</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl text-sm text-gray-600">Hủy</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">Ghi nhận</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
