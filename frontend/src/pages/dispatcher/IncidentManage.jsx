import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox } from '../../components/UI';
import { getAllIncidents, updateIncidentStatus, getAffectedGroups } from '../../services/incidentService';

export default function IncidentManage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [affected, setAffected] = useState({ open: false, groups: [], incidentId: null, incidentBusId: null });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    const params = filter ? { status: filter } : {};
    getAllIncidents(params)
      .then(res => setIncidents(res.data?.data || res.data || []))
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); load(); }, [filter]);

  useEffect(() => {
    const eventSource = new EventSource('http://localhost:5000/api/realtime/events');
    
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'INCIDENT_REPORTED') {
          setSuccess(`Tài xế ${payload.data.driver_name} vừa báo cáo sự cố mới!`);
          setTimeout(() => setSuccess(''), 5000);
          load();
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
  }, [filter]);

  const handleUpdateStatus = async (incidentId, newStatus) => {
    try {
      await updateIncidentStatus(incidentId, newStatus);
      setSuccess(`Đã cập nhật trạng thái sự cố sang: ${newStatus === 'resolved' ? 'Đã giải quyết' : 'Đang xử lý'}.`);
      setTimeout(() => setSuccess(''), 4000);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái');
      setTimeout(() => setError(''), 4000);
    }
  };

  const viewAffected = async (incident) => {
    try {
      const res = await getAffectedGroups(incident.incident_id);
      setAffected({ open: true, groups: res.data?.data || res.data || [], incidentId: incident.incident_id, incidentBusId: incident.bus_id });
    } catch {
      setAffected({ open: true, groups: [], incidentId: incident.incident_id, incidentBusId: incident.bus_id });
    }
  };

  const incidentTypes = {
    bus_broken: 'Hỏng xe buýt',
    delay: 'Trễ chuyến',
    cancelled: 'Hủy chuyến',
    other: 'Sự cố khác'
  };

  const statusLabel = {
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    resolved: 'Đã giải quyết'
  };

  const statusBg = {
    pending: 'bg-red-50 text-red-700 border-red-100',
    processing: 'bg-amber-50 text-amber-700 border-amber-100',
    resolved: 'bg-green-50 text-green-700 border-green-100'
  };

  return (
    <Layout>
      <PageHeader
        title="Nhật ký báo cáo sự cố"
        subtitle="Quản lý và cập nhật tiến độ xử lý các sự cố phát sinh trên đường chạy của tài xế"
        action={
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="border border-slate-200 bg-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          >
            <option value="">Tất cả sự cố</option>
            <option value="pending">Chờ xử lý</option>
            <option value="processing">Đang xử lý</option>
            <option value="resolved">Đã giải quyết</option>
          </select>
        }
      />

      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}
      {error && <div className="mb-4"><AlertBox type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-400 font-semibold animate-pulse">Đang tải nhật ký sự cố...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Tài xế báo cáo', 'Biển số xe', 'Thứ tự chuyến', 'Loại sự cố', 'Mô tả chi tiết', 'Trạng thái', 'Thao tác'].map(h => (
                    <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                      Không tìm thấy sự cố nào trong nhật ký
                    </td>
                  </tr>
                ) : (
                  incidents.map(i => (
                    <tr key={i.incident_id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-bold text-gray-900">{i.driver_name}</td>
                      <td className="px-6 py-4 font-mono font-semibold text-slate-700">{i.license_plate || '—'}</td>
                      <td className="px-6 py-4 font-mono font-semibold text-slate-600">
                        {i.trip_order ? `Chuyến thứ #${i.trip_order}` : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                          i.incident_type === 'bus_broken' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {incidentTypes[i.incident_type] || i.incident_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={i.description}>
                        {i.description}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBg[i.status]}`}>
                          {statusLabel[i.status] || i.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-xs space-y-1">
                        <div className="flex gap-2 items-center flex-wrap">
                          <button
                            onClick={() => viewAffected(i)}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
                          >
                            Ảnh hưởng
                          </button>
                          
                          {i.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateStatus(i.incident_id, 'processing')}
                              className="bg-amber-50 text-amber-700 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition"
                            >
                              Xử lý
                            </button>
                          )}
                          
                          {i.status !== 'resolved' && (
                            <button
                              onClick={() => handleUpdateStatus(i.incident_id, 'resolved')}
                              className="bg-green-50 text-green-700 hover:bg-green-100 px-2.5 py-1 rounded-lg transition"
                            >
                              Giải quyết
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Affected groups modal */}
      {affected.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAffected({ open: false, groups: [], incidentId: null, incidentBusId: null })}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5 border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Các nhóm chuyến bị ảnh hưởng</h3>
                {affected.incidentBusId && <p className="text-xs text-gray-500 font-semibold mt-0.5">Mã xe buýt: ID #{affected.incidentBusId}</p>}
              </div>
              <button onClick={() => setAffected({ open: false, groups: [], incidentId: null, incidentBusId: null })} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            {affected.groups.length === 0 ? (
              <div className="text-center py-8 text-gray-400 font-medium">Không phát hiện nhóm chuyến nào bị ảnh hưởng</div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {affected.groups.map(g => (
                  <div key={g.group_id} className="bg-red-50/30 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-red-900">{g.group_name}</div>
                        <div className="text-xs text-red-700 mt-1 font-semibold">Tuyến: {g.route_code} | Tài xế: {g.driver_name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Khung giờ: {new Date(g.start_time).toLocaleTimeString('vi-VN')} - {new Date(g.end_time).toLocaleTimeString('vi-VN')}
                        </div>
                      </div>
                      <span className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded-full font-bold">Xe gặp sự cố</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
              <button
                onClick={() => setAffected({ open: false, groups: [], incidentId: null, incidentBusId: null })}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition"
              >
                Đóng
              </button>
              {affected.groups.length > 0 && (
                <Link
                  to="/dispatcher/affected-trips"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/10 transition flex items-center"
                >
                  Điều phối khẩn cấp
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
