// pages/dispatcher/IncidentManage.jsx - Quản lý sự cố cho điều phối
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, AlertBox } from '../../components/UI';
import { getAllIncidents, updateIncidentStatus, getIncidentAffectedTrips } from '../../services/miscService';

export default function IncidentManage() {
  const [incidents, setIncidents] = useState([]);
  const [affected, setAffected] = useState({ open: false, trips: [], incidentId: null });
  const [success, setSuccess] = useState('');

  const load = () => getAllIncidents().then(res => setIncidents(res.data.data));
  useEffect(() => { load(); }, []);

  const handleResolve = async (id) => {
    try {
      await updateIncidentStatus(id, 'resolved');
      setSuccess('Đã xử lý sự cố'); load(); setTimeout(() => setSuccess(''), 3000);
    } catch (err) { alert(err.response?.data?.message || 'Lỗi'); }
  };

  const viewAffected = async (id) => {
    const res = await getIncidentAffectedTrips(id);
    setAffected({ open: true, trips: res.data.data, incidentId: id });
  };

  return (
    <Layout>
      <PageHeader title="Quản lý sự cố" subtitle="Theo dõi và xử lý sự cố xe buýt" />
      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Tài xế', 'Xe', 'Chuyến', 'Mô tả', 'Thời gian', 'Trạng thái', 'Thao tác'].map(h => (
                <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase ${h === 'Thao tác' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {incidents.map(i => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium">{i.driver_name}</td>
                <td className="px-4 py-3 text-sm font-mono">{i.bus_id || '—'}</td>
                <td className="px-4 py-3 text-sm font-mono">{i.trip_code || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{i.description}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(i.report_time).toLocaleString('vi-VN')}</td>
                <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => viewAffected(i.id)} className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded-lg">Chuyến bị ảnh hưởng</button>
                  {i.status === 'pending' && (
                    <button onClick={() => handleResolve(i.id)} className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2 py-1 rounded-lg">Đánh dấu xử lý</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {incidents.length === 0 && <div className="text-center py-12 text-gray-400">Không có sự cố nào</div>}
      </div>
      {affected.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAffected({ open: false, trips: [], incidentId: null })}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Chuyến bị ảnh hưởng</h3>
              <button onClick={() => setAffected({ open: false, trips: [], incidentId: null })} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {affected.trips.length === 0 ? (
              <p className="text-gray-500 text-sm">Không có chuyến nào bị ảnh hưởng.</p>
            ) : (
              <div className="space-y-2">
                {affected.trips.map(t => (
                  <div key={t.trip_code} className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm">
                    <div className="font-medium text-orange-800">Chuyến {t.trip_code}</div>
                    <div className="text-orange-600">Ngày: {t.trip_date} | Giờ: {t.scheduled_departure}</div>
                    <div className="text-orange-600 text-xs">Tài xế: {t.driver_code}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
