// pages/driver/DriverSchedule.jsx — Lịch làm việc tài xế
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader } from '../../components/UI';
import { getMySchedule } from '../../services/tripService';
import { useAuth } from '../../context/AuthContext';

export default function DriverSchedule() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (filterDate) params.trip_date = filterDate;
    getMySchedule(params)
      .then(res => setSchedule(res.data?.data || []))
      .catch(() => setSchedule([]))
      .finally(() => setLoading(false));
  }, [filterDate]);

  const tripStatusColor = {
    unassigned: '#ea580c', assigned: '#2563eb', in_progress: '#16a34a',
    completed: '#64748b', delayed: '#d97706', cancelled: '#dc2626'
  };
  const tripStatusLabel = {
    unassigned: 'Chưa phân công', assigned: 'Đã phân công', in_progress: 'Đang chạy',
    completed: 'Hoàn thành', delayed: 'Hoàn thành trễ', cancelled: 'Đã hủy'
  };

  // Stats
  const today = new Date().toISOString().split('T')[0];
  const todayTrips = schedule.filter(s => {
    const d = s.trip_date instanceof Date
      ? s.trip_date.toISOString().split('T')[0]
      : (s.trip_date || '').substring(0, 10);
    return d === today;
  });

  return (
    <Layout>
      <PageHeader
        title="Lịch làm việc"
        subtitle={`Xin chào, ${user?.username} — Lịch chuyến xe được phân công`}
        action={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="text-sm text-gray-500 hover:text-gray-700 px-2 py-2"
              >
                ✕
              </button>
            )}
          </div>
        }
      />

      {/* Summary cards */}
      {!filterDate && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Hôm nay', value: todayTrips.length, color: '#2563eb' },
            { label: 'Tổng chuyến', value: schedule.length, color: '#16a34a' },
            { label: 'Hoàn thành', value: schedule.filter(s => s.trip_status === 'completed' || s.trip_status === 'delayed').length, color: '#64748b' },
            { label: 'Chưa thực hiện', value: schedule.filter(s => s.trip_status === 'assigned' || s.trip_status === 'unassigned').length, color: '#d97706' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-1">
              <div className="text-2xl font-bold" style={{ color }}>{value}</div>
              <div className="text-xs text-gray-500 font-medium">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Đang tải lịch làm việc...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Mã chuyến', 'Tuyến xe', 'Chiều', 'Ngày chạy', 'Giờ chạy dự kiến', 'Xe được phân công', 'Trạng thái'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {schedule.map(s => {
                const dateStr = s.trip_date instanceof Date
                  ? s.trip_date.toLocaleDateString('vi-VN')
                  : new Date(s.trip_date).toLocaleDateString('vi-VN');
                const isToday = (s.trip_date || '').substring(0, 10) === today;
                return (
                  <tr key={s.trip_code} className={`hover:bg-slate-50 transition ${isToday ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-6 py-4 font-mono text-sm font-semibold text-gray-900">
                      {isToday && <span className="inline-flex w-2 h-2 rounded-full bg-blue-500 mr-2"></span>}
                      {s.trip_code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="font-medium">{s.route_code}</div>
                      <div className="text-xs text-gray-400">{s.route_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.direction === 'outbound' ? 'bg-indigo-50 text-indigo-600' : 'bg-pink-50 text-pink-600'}`}>
                        {s.direction === 'outbound' ? '→ Đi' : '← Về'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                      {isToday ? <span className="text-blue-600 font-medium">Hôm nay</span> : dateStr}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-900">
                      {s.scheduled_departure?.substring(0, 5)} – {s.scheduled_arrival?.substring(0, 5) || '?'}
                    </td>
                    <td className="px-6 py-4">
                      {s.bus_id ? (
                        <span className="text-sm font-mono text-gray-700">{s.bus_id}</span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Chưa phân công xe</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          background: (tripStatusColor[s.trip_status] || '#64748b') + '20',
                          color: tripStatusColor[s.trip_status] || '#64748b',
                        }}
                      >
                        {tripStatusLabel[s.trip_status] || s.trip_status || '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && schedule.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">
            {filterDate ? `Không có lịch làm việc ngày ${filterDate}` : 'Không có lịch làm việc nào được phân công'}
          </div>
        )}
      </div>
    </Layout>
  );
}
