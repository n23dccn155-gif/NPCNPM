import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader } from '../../components/UI';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function MyAssignmentsPage() {
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Mặc định xem tuần hiện tại từ ngày hôm nay
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setLoading(true);
    api.get(`/scheduler/my-schedule?date=${filterDate}`)
      .then(res => setScheduleData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterDate]);

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
        title="Lịch trình của tôi (My Assignments)"
        subtitle={`Xin chào, ${user?.full_name || user?.username} — Xem trước lịch làm việc 7 ngày tới`}
        action={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Đang tải lịch trình...</div>
        ) : scheduleData?.schedule?.[0] ? (
          <div className="p-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  Lịch trình ngày {new Date(scheduleData.schedule[0].date).toLocaleDateString('vi-VN')}
                </h3>
                <div className="text-sm text-gray-500 mt-1 flex items-center gap-4">
                  <div>
                    Ca làm việc: <span className={`px-2 py-1 ml-1 rounded-full text-xs font-bold border ${getBadgeClass(scheduleData.schedule[0].shiftBadge)}`}>{scheduleData.schedule[0].shift}</span>
                  </div>
                  <div className="border-l border-gray-300 pl-4">
                    Tuyến: <span className="font-semibold text-gray-700 ml-1">{scheduleData.driver_info?.route_code} {scheduleData.driver_info?.route_name ? `- ${scheduleData.driver_info.route_name}` : ''}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Mã xe phân bổ</div>
                {scheduleData.schedule[0].isStandby ? (
                  <span className="px-3 py-1 rounded bg-gray-200 text-gray-600 font-bold text-sm border border-gray-300">STANDBY</span>
                ) : (
                  <span className="text-xl font-mono text-gray-800 font-bold bg-slate-100 px-3 py-1 rounded">{scheduleData.schedule[0].bus_id}</span>
                )}
              </div>
            </div>

            {scheduleData.schedule[0].isStandby ? (
              <div className="bg-blue-50 text-blue-700 p-6 rounded-xl text-center border border-blue-100">
                <p className="font-bold text-lg mb-2">Hôm nay bạn là Tài xế Dự Bị!</p>
                <p className="text-sm">Vui lòng có mặt tại bến đúng giờ để sẵn sàng nhận lệnh điều động bổ sung từ Điều phối viên.</p>
              </div>
            ) : (
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">Danh sách chuyến xe (Trips)</h4>
                <div className="overflow-hidden border border-gray-200 rounded-xl">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã chuyến</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chiều chạy</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Xuất bến</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Đến nơi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {scheduleData.schedule[0].trips?.map((trip, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/50 transition">
                          <td className="px-4 py-3 font-mono text-sm font-bold text-gray-700">{trip.tripCode}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${trip.direction === 'Chiều đi' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {trip.direction}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-900 font-bold">{trip.depTime}</td>
                          <td className="px-4 py-3 font-mono text-gray-600">{trip.arrTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">Không có dữ liệu lịch trình</div>
        )}
      </div>
    </Layout>
  );
}
