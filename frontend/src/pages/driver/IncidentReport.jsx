// pages/driver/IncidentReport.jsx
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, Modal, AlertBox } from '../../components/UI';
import { createIncident, getMyIncidents } from '../../services/miscService';
import { getBuses } from '../../services/busService';

export default function IncidentReport() {
  const [incidents, setIncidents] = useState([]);
  const [buses, setBuses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ bus_id: '', trip_code: '', incident_type: 'other', description: '' });
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    const [incRes, busRes] = await Promise.all([getMyIncidents(), getBuses()]);
    setIncidents(incRes.data?.data || []);
    setBuses(busRes.data?.data || []);
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setFormError('');
    try {
      await createIncident(form);
      setShowModal(false); setSuccess('Báo cáo sự cố đã được gửi!');
      load(); setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setFormError(err.response?.data?.message || 'Lỗi gửi báo cáo'); }
  };

  const typeLabel = { bus_broken: 'Hỏng xe', traffic_delay: 'Trễ giao thông', other: 'Khác' };

  return (
    <Layout>
      <PageHeader title="Báo cáo sự cố" subtitle="Ghi nhận sự cố xe hoặc trong chuyến"
        action={<button onClick={() => { setForm({ bus_id: '', trip_code: '', incident_type: 'other', description: '' }); setFormError(''); setShowModal(true); }}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium">⚠️ Báo sự cố</button>} />
      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Xe', 'Mã chuyến', 'Loại sự cố', 'Mô tả', 'Trạng thái', 'Thời gian báo'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {incidents.map(i => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium">{i.bus_id || '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-600 font-mono">{i.trip_code || '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${i.incident_type === 'bus_broken' ? 'bg-red-50 text-red-600' : (i.incident_type === 'traffic_delay' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600')}`}>
                    {typeLabel[i.incident_type] || i.incident_type}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{i.description}</td>
                <td className="px-6 py-4"><StatusBadge status={i.status} /></td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(i.report_time).toLocaleString('vi-VN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {incidents.length === 0 && <div className="text-center py-16 text-gray-400">Chưa có báo cáo sự cố nào</div>}
      </div>
      <Modal isOpen={showModal} title="Báo cáo sự cố" onClose={() => setShowModal(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Xe liên quan</label>
              <select value={form.bus_id} onChange={e => setForm({ ...form, bus_id: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Không xác định —</option>
                {buses.map(b => <option key={b.bus_id} value={b.bus_id}>{b.bus_id}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loại sự cố *</label>
              <select value={form.incident_type} onChange={e => setForm({ ...form, incident_type: e.target.value })} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="other">Khác</option>
                <option value="bus_broken">Hỏng xe</option>
                <option value="traffic_delay">Trễ giao thông</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã chuyến (nếu có)</label>
            <input value={form.trip_code} onChange={e => setForm({ ...form, trip_code: e.target.value })}
              placeholder="Ví dụ: CX001 (không bắt buộc)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả sự cố *</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required rows={4}
              placeholder="Mô tả chi tiết sự cố..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl text-sm text-gray-600">Hủy</button>
            <button type="submit" className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium">Gửi báo cáo</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
