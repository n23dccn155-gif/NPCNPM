// pages/driver/DriverSchedule.jsx
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge } from '../../components/UI';
import { getSchedule } from '../../services/tripService';
import { useAuth } from '../../context/AuthContext';

export default function DriverSchedule() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    getSchedule().then(res => setSchedule(res.data.data)).finally(() => setLoading(false));
  }, []);

  // Lọc chỉ hiển thị chuyến của tài xế đang đăng nhập
  const mySchedule = schedule.filter(s => s.driver_code && s.driver_name);

  return (
    <Layout>
      <PageHeader title="Lịch làm việc" subtitle={`Xin chào, ${user?.username}`} />
      {loading ? <div className="text-center py-12 text-gray-500">Đang tải...</div> : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Mã chuyến', 'Tuyến', 'Ngày', 'Giờ xuất bến', 'Xe', 'Trạng thái'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {schedule.map(s => (
                <tr key={s.trip_code} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm font-medium">{s.trip_code}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{s.route_code} - {s.route_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{s.trip_date}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{s.scheduled_departure}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{s.bus_id || '—'}</td>
                  <td className="px-6 py-4"><StatusBadge status={s.assignment_status || 'pending'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {schedule.length === 0 && <div className="text-center py-16 text-gray-400">Không có lịch làm việc</div>}
        </div>
      )}
    </Layout>
  );
}
