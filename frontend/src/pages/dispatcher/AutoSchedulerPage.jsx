import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader } from '../../components/UI';
import api from '../../services/api';

export default function AutoSchedulerPage() {
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [routes, setRoutes] = useState([]);
  const [filterRoute, setFilterRoute] = useState('');

  useEffect(() => {
    api.get('/routes?status=active').then(res => setRoutes(res.data.data)).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    let url = `/scheduler/daily?date=${filterDate}`;
    if (filterRoute) url += `&route_code=${filterRoute}`;
    api.get(url)
      .then(res => setScheduleData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterDate, filterRoute]);

  const getBadgeClass = (badgeType) => {
    switch(badgeType) {
      case 'primary': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'warning': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'info': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'danger': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Auto-Scheduler (Advanced)"
        subtitle="Tổng quan chiến dịch điều độ trong ngày theo thuật toán Module Time Ring"
        action={
          <div className="flex items-center gap-3">
            <select
              value={filterRoute}
              onChange={e => setFilterRoute(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Tất cả tuyến</option>
              {routes.map(r => (
                <option key={r.route_code} value={r.route_code}>
                  {r.route_code} - {r.route_name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        }
      />

      {scheduleData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-1">
            <div className="text-2xl font-bold text-gray-800">{scheduleData.stats.active_buses}</div>
            <div className="text-xs text-gray-500 font-medium">Tổng số xe (Active)</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-1">
            <div className="text-2xl font-bold text-blue-600">{scheduleData.stats.needed_drivers}</div>
            <div className="text-xs text-gray-500 font-medium">Tài xế cần thiết (Drivers Needed)</div>
          </div>
          <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-1 ${scheduleData.stats.alert ? 'border-red-500 bg-red-50' : ''}`}>
            <div className={`text-2xl font-bold ${scheduleData.stats.alert ? 'text-red-600' : 'text-green-600'}`}>
              {scheduleData.stats.available_drivers}
            </div>
            <div className="text-xs text-gray-500 font-medium">Tài xế có mặt (Available)</div>
            {scheduleData.stats.alert && <div className="text-xs text-red-500 mt-1 font-semibold">⚠️ CẢNH BÁO: Thiếu tài xế!</div>}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Đang tính toán phân luồng...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tài xế</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tuyến</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ca làm việc (Shift)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giờ xuất bến</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã xe phân bổ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {scheduleData?.schedule?.map(s => (
                <tr key={s.driver_code} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{s.full_name}</div>
                    <div className="text-xs text-gray-500 font-mono">{s.driver_code}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                    <div>{s.route_code}</div>
                    {s.route_name && <div className="text-xs text-gray-500 font-normal mt-0.5">{s.route_name}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getBadgeClass(s.shiftBadge)}`}>
                      {s.shift}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-900 font-bold">{s.departureTime}</td>
                  <td className="px-6 py-4">
                    {s.isStandby ? (
                      <span className="px-2 py-1 rounded bg-gray-100 text-gray-500 font-bold text-xs border border-gray-200">STANDBY</span>
                    ) : (
                      <span className="text-sm font-mono text-gray-700 font-semibold">{s.bus_id}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
