import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getSchedule } from '../../services/tripService';
import { getRoutes } from '../../services/routeService';
import { getBuses } from '../../services/busService';
import { getDrivers } from '../../services/driverService';
import { getAllIncidents } from '../../services/miscService';

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
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ routes: 0, buses: 0, drivers: 0, trips: 0, incidents: 0 });
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      getRoutes({ status: 'active' }).catch(() => ({ data: { data: [] } })),
      getBuses({ status: 'active' }).catch(() => ({ data: { data: [] } })),
      getDrivers({ status: 'active' }).catch(() => ({ data: { data: [] } })),
      getSchedule({ trip_date: today }).catch(() => ({ data: { data: [] } })),
      getAllIncidents({ status: 'pending' }).catch(() => ({ data: { data: [] } })),
    ]).then(([routeRes, busRes, driverRes, tripRes, incidentRes]) => {
      const trips = tripRes.data?.data || [];
      setStats({
        routes: routeRes.data?.data?.length || 0,
        buses: busRes.data?.data?.length || 0,
        drivers: driverRes.data?.data?.length || 0,
        trips: trips.length,
        incidents: incidentRes.data?.data?.length || 0,
      });
      setRecentTrips(trips.slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  const roleLabel = { admin: 'Quản trị viên', manager: 'Quản lý', dispatcher: 'Điều phối viên', driver: 'Tài xế' };

  const tripStatusColor = { unassigned: '#ea580c', assigned: '#2563eb', in_progress: '#16a34a', completed: '#64748b', delayed: '#d97706', cancelled: '#dc2626' };
  const tripStatusLabel = { unassigned: 'Chưa phân công', assigned: 'Đã phân công', in_progress: 'Đang chạy', completed: 'Hoàn thành', delayed: 'Trễ', cancelled: 'Đã hủy' };

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan hệ thống</h1>
        <p className="text-gray-500 text-sm mt-1">Theo dõi hoạt động xe buýt hôm nay</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          <StatCard icon="🗺️" value={stats.routes} label="Tuyến hoạt động" color="#2563eb" />
          <StatCard icon="🚌" value={stats.buses} label="Xe hoạt động" color="#16a34a" />
          <StatCard icon="👤" value={stats.drivers} label="Tài xế làm việc" color="#7c3aed" />
          <StatCard icon="📅" value={stats.trips} label="Chuyến hôm nay" color="#ea580c" />
          <StatCard icon="⚠️" value={stats.incidents} label="Sự cố chờ xử lý" color="#dc2626" />
        </div>
      )}

      {/* Recent trips */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-gray-900">Lịch chuyến gần nhất</h2>
          <p className="text-xs text-gray-400 mt-0.5">Các chuyến xe trong ngày hôm nay</p>
        </div>
        {recentTrips.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {loading ? 'Đang tải...' : 'Không có chuyến nào hôm nay'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Mã chuyến', 'Tuyến', 'Giờ chạy dự kiến', 'Xe', 'Tài xế', 'Trạng thái'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentTrips.map(t => (
                <tr key={t.trip_code} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 font-mono text-sm font-semibold text-gray-900">{t.trip_code}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.route_code} - {t.route_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                    {t.scheduled_departure?.substring(0, 5)} – {t.scheduled_arrival?.substring(0, 5) || '?'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.bus_id || <span className="text-gray-400 italic">Chưa phân công</span>}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.driver_name || <span className="text-gray-400 italic">—</span>}</td>
                  <td className="px-6 py-4">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: (tripStatusColor[t.trip_status] || '#64748b') + '20',
                        color: tripStatusColor[t.trip_status] || '#64748b',
                      }}
                    >
                      {tripStatusLabel[t.trip_status] || t.trip_status || 'Chưa phân công'}
                    </span>
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
