import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox } from '../../components/UI';
import { getMyTrips, startTrip, finishTrip } from '../../services/tripService';
import { useAuth } from '../../context/AuthContext';

export default function MyAssignmentsPage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadMyTrips = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await getMyTrips(filterDate);
      setTrips(res.data?.data || res.data || []);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Không thể tải lịch trình. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyTrips();
  }, [filterDate]);

  const handleStartTrip = async (tripId) => {
    try {
      const res = await startTrip(tripId);
      setSuccessMsg(res.data?.message || 'Đã ghi nhận bắt đầu hành trình xuất bến!');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadMyTrips();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể ghi nhận xuất bến.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleFinishTrip = async (tripId) => {
    try {
      const res = await finishTrip(tripId);
      setSuccessMsg(res.data?.message || 'Đã ghi nhận hoàn thành chuyến xe!');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadMyTrips();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể ghi nhận hoàn thành.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'scheduled': return 'Chờ xuất bến';
      case 'running': return 'Đang chạy';
      case 'completed': return 'Đã hoàn thành';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'running': return 'bg-green-50 text-green-700 border-green-100';
      case 'completed': return 'bg-slate-50 text-slate-700 border-slate-200';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-700';
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Lịch trình & Lộ trình của tôi"
        subtitle={`Xin chào, tài xế ${user?.full_name || user?.username} — Nhận ca chạy, ghi nhận giờ xuất/cập bến thực tế`}
        action={
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Chọn ngày chạy:</label>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        }
      />

      {successMsg && <div className="mb-4"><AlertBox type="success" message={successMsg} /></div>}
      {errorMsg && <div className="mb-4"><AlertBox type="error" message={errorMsg} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        {loading ? (
          <div className="text-center py-16 text-slate-400 font-semibold animate-pulse">Đang nạp ca chạy...</div>
        ) : trips.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-medium">
            📭 Bạn không có ca chạy nào được phân công trong ngày {new Date(filterDate).toLocaleDateString('vi-VN')}.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header info for driver's current bus */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Ca chạy hôm nay</h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">Nhóm chuyến: {trips[0]?.group_name}</p>
              </div>
              <div className="bg-blue-600 text-white font-mono font-bold text-lg px-4 py-2 rounded-xl shadow-md shadow-blue-500/10">
                BIỂN SỐ XE: {trips[0]?.license_plate || 'CHƯA PHÂN XE'}
              </div>
            </div>

            {/* List of individual trips for this driver */}
            <div className="space-y-4">
              <h4 className="font-bold text-slate-900 text-sm tracking-wide uppercase">Lộ trình các chuyến</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trips.map((t) => {
                  const isScheduled = t.status === 'scheduled' || t.status === 'assigned';
                  const isRunning = t.status === 'running';
                  
                  return (
                    <div key={t.trip_id} className="border border-slate-100 rounded-xl p-5 bg-white hover:shadow-sm transition flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-sm text-slate-800">CHUYẾN #{t.trip_order}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-2xs font-bold border ${getStatusColor(t.status)}`}>
                            {getStatusText(t.status)}
                          </span>
                        </div>
                        
                        <div className="mt-3 space-y-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="text-slate-400 font-semibold">Điểm đi:</span>
                            <span className="font-bold text-slate-700">{t.start_point}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                            <span className="text-slate-400 font-semibold">Điểm đến:</span>
                            <span className="font-bold text-slate-700">{t.end_point}</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-2xs">
                          <div>
                            <div className="text-slate-400 font-semibold">Xuất bến KH:</div>
                            <div className="font-mono font-bold text-slate-700 text-sm mt-0.5">
                              {new Date(t.scheduled_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {t.actual_departure && (
                              <div className="text-green-600 font-semibold mt-1">
                                Thực tế: {new Date(t.actual_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-slate-400 font-semibold">Cập bến KH:</div>
                            <div className="font-mono font-bold text-slate-700 text-sm mt-0.5">
                              {new Date(t.scheduled_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {t.actual_arrival && (
                              <div className="text-green-600 font-semibold mt-1">
                                Thực tế: {new Date(t.actual_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Driver Action Button */}
                      <div>
                        {isScheduled && (
                          <button
                            onClick={() => handleStartTrip(t.trip_id)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-blue-500/10"
                          >
                            🛫 Ghi nhận xuất bến
                          </button>
                        )}
                        {isRunning && (
                          <button
                            onClick={() => handleFinishTrip(t.trip_id)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-green-500/10"
                          >
                            🛬 Ghi nhận cập bến
                          </button>
                        )}
                        {t.status === 'completed' && (
                          <div className="text-center text-xs font-bold text-slate-400 py-2.5 bg-slate-50 rounded-xl">
                            ✓ Hoàn tất {t.delay_minutes > 0 && `(Trễ ${t.delay_minutes}p)`}
                          </div>
                        )}

                        {t.status === 'cancelled' && (
                          <div className="text-center text-xs font-bold text-red-400 py-2.5 bg-red-50/50 rounded-xl border border-red-100">
                            ✕ Chuyến đi đã hủy
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
