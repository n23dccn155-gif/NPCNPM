// pages/dispatcher/IncidentManage.jsx — Quản lý sự cố (cải tiến đầy đủ)
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, AlertBox } from '../../components/UI';
import { getAllIncidents, updateIncidentStatus, getIncidentAffectedTrips } from '../../services/miscService';

export default function IncidentManage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [affected, setAffected] = useState({ open: false, trips: [], incidentId: null, incidentBusId: null });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    const params = filter ? { status: filter } : {};
    getAllIncidents(params)
      .then(res => setIncidents(res.data?.data || []))
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); load(); }, [filter]);

  const handleUpdateStatus = async (id, newStatus, busId) => {
    try {
      await updateIncidentStatus(id, newStatus);
      setSuccess(`Đã cập nhật trạng thái sự cố${newStatus === 'resolved' ? ' (xe đã được đánh dấu hỏng)' : ''}`);
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (err) { setError(err.response?.data?.message || 'Lỗi cập nhật'); setTimeout(() => setError(''), 3000); }
  };

  const viewAffected = async (incident) => {
    try {
      const res = await getIncidentAffectedTrips(incident.id);
      setAffected({ open: true, trips: res.data?.data || [], incidentId: incident.id, incidentBusId: incident.bus_id });
    } catch { setAffected({ open: true, trips: [], incidentId: incident.id, incidentBusId: incident.bus_id }); }
  };

  const incidentStatusLabel = { pending: 'Chờ xử lý', in_progress: 'Đang xử lý', resolved: 'Đã xử lý' };
  const incidentStatusColor = { pending: '#dc2626', in_progress: '#d97706', resolved: '#16a34a' };

  return (
    <Layout>
      <PageHeader
        title="Quản lý sự cố"
        subtitle="Theo dõi và xử lý sự cố xe buýt"
        action={
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả sự cố</option>
            <option value="pending">Chờ xử lý</option>
            <option value="in_progress">Đang xử lý</option>
            <option value="resolved">Đã xử lý</option>
          </select>
        }
      />

      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}
      {error && <div className="mb-4"><AlertBox type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Đang tải...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Tài xế', 'Xe buýt', 'Chuyến', 'Loại sự cố', 'Mô tả sự cố', 'Thời gian', 'Trạng thái', 'Thao tác'].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase ${h === 'Thao tác' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {incidents.map(i => {
                const typeLabel = { bus_broken: 'Hỏng xe', traffic_delay: 'Trễ GT', other: 'Khác' };
                const typeBg = { bus_broken: 'bg-red-50 text-red-600', traffic_delay: 'bg-amber-50 text-amber-600', other: 'bg-slate-50 text-slate-600' };
                return (
                <tr key={i.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">{i.driver_name || i.driver_code}</td>
                  <td className="px-4 py-4 text-sm font-mono text-gray-700">{i.bus_id || '—'}</td>
                  <td className="px-4 py-4 text-sm font-mono text-gray-700">{i.trip_code || '—'}</td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeBg[i.incident_type] || typeBg.other}`}>
                      {typeLabel[i.incident_type] || i.incident_type || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 max-w-xs">
                    <span className="line-clamp-2">{i.description}</span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(i.report_time).toLocaleString('vi-VN')}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: (incidentStatusColor[i.status] || '#64748b') + '15',
                        color: incidentStatusColor[i.status] || '#64748b',
                      }}
                    >
                      {incidentStatusLabel[i.status] || i.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex gap-2 justify-end flex-wrap">
                      <button
                        onClick={() => viewAffected(i)}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2.5 py-1.5 rounded-lg font-medium transition"
                      >
                        Chuyến bị ảnh hưởng
                      </button>
                      {i.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateStatus(i.id, 'in_progress', i.bus_id)}
                          className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-2.5 py-1.5 rounded-lg font-medium transition"
                        >
                          Đang xử lý
                        </button>
                      )}
                      {(i.status === 'pending' || i.status === 'in_progress') && (
                        <button
                          onClick={() => handleUpdateStatus(i.id, 'resolved', i.bus_id)}
                          className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2.5 py-1.5 rounded-lg font-medium transition"
                        >
                          Đã xử lý
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        )}
        {!loading && incidents.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">Không có sự cố nào</div>
        )}
      </div>

      {/* Affected trips modal */}
      {affected.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAffected({ open: false, trips: [], incidentId: null, incidentBusId: null })}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Chuyến bị ảnh hưởng</h3>
                {affected.incidentBusId && <p className="text-xs text-gray-500 mt-0.5">Xe: {affected.incidentBusId}</p>}
              </div>
              <button onClick={() => setAffected({ open: false, trips: [], incidentId: null, incidentBusId: null })} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            {affected.trips.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Không có chuyến nào bị ảnh hưởng</div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {affected.trips.map(t => (
                  <div key={t.trip_code} className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-sm font-semibold text-orange-800">Chuyến {t.trip_code}</div>
                        <div className="text-xs text-orange-600 mt-0.5">{t.trip_date} | {t.scheduled_departure}</div>
                        {t.driver_code && <div className="text-xs text-orange-600">Tài xế: {t.driver_name || t.driver_code}</div>}
                      </div>
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg font-medium">Cần điều chỉnh</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setAffected({ open: false, trips: [], incidentId: null, incidentBusId: null })}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Đóng
              </button>
              <a
                href="/dispatcher/affected-trips"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition"
              >
                Đi đến trang điều chỉnh
              </a>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
