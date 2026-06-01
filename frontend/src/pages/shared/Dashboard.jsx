import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { getTrips } from '../../services/tripService';
import { getRoutes } from '../../services/routeService';
import { getDrivers } from '../../services/driverService';
import { getAllIncidents } from '../../services/incidentService';

// Let's import from busService correctly
import { getBuses as getBusesApi } from '../../services/busService';

function StatCard({ icon, value, label, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 shadow-sm">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color + '20' }}
      >
        <span style={{ color }} className="text-xl">{icon}</span>
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500 font-medium">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({ routes: 0, buses: 0, drivers: 0, trips: 0, incidents: 0 });
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      getRoutes({ status: 'active' }).catch(() => ({ data: { data: [] } })),
      getBusesApi({ status: 'active' }).catch(() => ({ data: { data: [] } })),
      getDrivers({ status: 'active' }).catch(() => ({ data: { data: [] } })),
      getTrips({ date: today }).catch(() => ({ data: { data: [] } })),
      getAllIncidents({ status: 'pending' }).catch(() => ({ data: { data: [] } })),
    ]).then(([routeRes, busRes, driverRes, tripRes, incidentRes]) => {
      const routesList = routeRes.data?.data || routeRes.data || [];
      const busesList = busRes.data?.data || busRes.data || [];
      const driversList = driverRes.data?.data || driverRes.data || [];
      const tripsList = tripRes.data?.data || tripRes.data || [];
      const incidentsList = incidentRes.data?.data || incidentRes.data || [];

      setStats({
        routes: routesList.length,
        buses: busesList.length,
        drivers: driversList.length,
        trips: tripsList.length,
        incidents: incidentsList.length,
      });
      setRecentTrips(tripsList.slice(0, 5));
    }).catch(err => {
      console.error(err);
    }).finally(() => setLoading(false));
  }, []);

  const tripStatusColor = {
    scheduled: '#ea580c',
    assigned: '#2563eb',
    running: '#16a34a',
    completed: '#64748b',
    cancelled: '#dc2626'
  };

  const tripStatusLabel = {
    scheduled: 'Đã lập chuyến',
    assigned: 'Đã phân công',
    running: 'Đang chạy',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy'
  };

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan hệ thống</h1>
        <p className="text-gray-500 text-sm mt-1">Theo dõi hoạt động vận chuyển xe buýt hôm nay</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          <StatCard icon="🗺️" value={stats.routes} label="Tuyến hoạt động" color="#2563eb" />
          <StatCard icon="🚌" value={stats.buses} label="Xe hoạt động" color="#16a34a" />
          <StatCard icon="👤" value={stats.drivers} label="Tài xế sẵn sàng" color="#7c3aed" />
          <StatCard icon="📅" value={stats.trips} label="Chuyến hôm nay" color="#ea580c" />
          <StatCard icon="⚠️" value={stats.incidents} label="Sự cố chờ xử lý" color="#dc2626" />
        </div>
      )}

      {/* Recent trips */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-gray-900">Lịch chuyến xe hôm nay</h2>
          <p className="text-xs text-gray-400 mt-0.5">Danh sách các chuyến xe vừa bắt đầu hoặc được lập lịch</p>
        </div>
        {recentTrips.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {loading ? 'Đang tải...' : 'Không có chuyến nào hôm nay'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Mã Chuyến', 'Nhóm Chuyến', 'Tuyến', 'Hướng đi', 'Giờ chạy', 'Trạng thái'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentTrips.map(t => (
                  <tr key={t.trip_id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-mono text-sm font-semibold text-gray-900">TRIP-{t.trip_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-semibold">{t.group_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{t.route_code}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {t.direction_type === 'outbound' ? 'Chiều đi' : 'Chiều về'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                      {new Date(t.scheduled_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          background: (tripStatusColor[t.status] || '#64748b') + '20',
                          color: tripStatusColor[t.status] || '#64748b',
                        }}
                      >
                        {tripStatusLabel[t.status] || t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
