import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox, ConfirmDialog, StatusBadge } from '../../components/UI';
import { getMyTrips, startTrip, finishTrip } from '../../services/tripService';
import { useAuth } from '../../context/AuthContext';

export default function MyAssignmentsPage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [assignmentType, setAssignmentType] = useState('off');
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirm, setConfirm] = useState({ open: false, type: '', trip: null });
  const [currentTime, setCurrentTime] = useState(new Date());

  const loadMyTrips = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await getMyTrips(filterDate);
      const data = res.data?.data || res.data;
      if (Array.isArray(data)) {
        setTrips(data);
        setAssignmentType(data.length > 0 ? 'main' : 'off');
      } else {
        setTrips(data?.trips || []);
        setAssignmentType(data?.assignment_type || 'off');
      }
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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000); // refresh every 10s
    return () => clearInterval(timer);
  }, []);

  const handleStartTrip = async (tripId) => {
    try {
      const res = await startTrip(tripId);
      setSuccessMsg(res.data?.message || 'Đã ghi nhận bắt đầu hành trình xuất bến thành công!');
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
      setSuccessMsg(res.data?.message || 'Đã ghi nhận hoàn thành chuyến xe thành công!');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadMyTrips();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể ghi nhận hoàn thành.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleConfirmAction = async () => {
    const { type, trip } = confirm;
    setConfirm({ open: false, type: '', trip: null });
    if (!trip) return;

    if (type === 'start') {
      await handleStartTrip(trip.trip_id);
    } else if (type === 'finish') {
      await handleFinishTrip(trip.trip_id);
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
        ) : assignmentType === 'standby_morning' ? (
          <div className="text-center py-20 bg-yellow-50 rounded-2xl border border-yellow-100">
            <span className="text-4xl block mb-4">☀️</span>
            <p className="text-yellow-700 font-medium text-lg">Sẵn sàng hỗ trợ!</p>
            <p className="text-yellow-800 font-bold text-2xl mt-2">Hôm nay bạn trực DỰ BỊ SÁNG</p>
          </div>
        ) : assignmentType === 'standby_afternoon' ? (
          <div className="text-center py-20 bg-orange-50 rounded-2xl border border-orange-100">
            <span className="text-4xl block mb-4">🌇</span>
            <p className="text-orange-700 font-medium text-lg">Sẵn sàng hỗ trợ!</p>
            <p className="text-orange-800 font-bold text-2xl mt-2">Hôm nay bạn trực DỰ BỊ CHIỀU</p>
          </div>
        ) : assignmentType === 'leave' ? (
          <div className="text-center py-20 bg-red-50 rounded-2xl border border-red-100 shadow-inner">
            <span className="text-4xl block mb-4 animate-bounce">🏖️</span>
            <p className="text-red-700 font-medium text-lg">Đã duyệt nghỉ phép!</p>
            <p className="text-red-800 font-bold text-2xl mt-2">Ngày hôm nay bạn ĐÃ XIN NGHỈ</p>
            <p className="text-red-600 font-medium mt-2">Hãy tận hưởng ngày nghỉ của mình nhé!</p>
          </div>
        ) : assignmentType === 'off' ? (
          <div className="text-center py-20 bg-green-50 rounded-2xl border border-green-100">
            <span className="text-4xl block mb-4">🎉</span>
            <p className="text-green-700 font-medium text-lg">Chúc mừng!</p>
            <p className="text-green-800 font-bold text-2xl mt-2">Hôm nay bạn ĐƯỢC NGHỈ</p>
            <p className="text-green-600 font-medium mt-2">Hãy dành thời gian nạp lại năng lượng nhé!</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-medium">
            📭 Bạn không có ca chạy nào được phân công trong ngày {new Date(filterDate).toLocaleDateString('vi-VN')}.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header info for driver's current bus */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg font-sans">Ca chạy hôm nay</h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">Nhóm chuyến: {trips[0]?.group_name}</p>
              </div>
              <div className="bg-blue-600 text-white font-mono font-bold text-lg px-4 py-2 rounded-xl shadow-md shadow-blue-500/10">
                BIỂN SỐ XE: {trips[0]?.license_plate || 'CHƯA PHÂN XE'}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-slate-900 text-base tracking-wide uppercase">Lộ trình các chuyến</h4>
              
              <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-4 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Chuyến</th>
                      <th className="px-4 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Xe Buýt</th>
                      <th className="px-4 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Lộ trình</th>
                      <th className="px-4 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Khởi hành</th>
                      <th className="px-4 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Đến nơi</th>
                      <th className="px-4 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-500 uppercase tracking-wider">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {trips.map((t) => {
                      const isScheduled = t.status === 'scheduled' || t.status === 'assigned';
                      const isRunning = t.status === 'running';
                      const scheduledDep = new Date(t.scheduled_departure);
                      const canStart = currentTime >= scheduledDep;

                      return (
                        <tr key={t.trip_id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-4 font-mono font-bold text-slate-800 text-base tabular-nums">
                            #{t.trip_order}
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-700 text-sm font-bold rounded-md font-mono border border-slate-200 tabular-nums">
                              {t.license_plate || 'Chưa xếp'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-bold text-slate-800 text-base">
                              {t.start_point} &rarr; {t.end_point}
                            </div>
                            <div className="text-xs font-semibold text-slate-500 mt-0.5">
                              {t.direction_type === 'outbound' ? 'Lượt đi' : 'Lượt về'}
                            </div>
                          </td>
                          <td className="px-4 py-4 font-mono font-semibold text-slate-700 text-base tabular-nums">
                            <div className="text-slate-500 text-xs line-through">KH: {new Date(t.scheduled_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                            <div className={t.actual_departure ? "text-green-600 font-bold" : "text-slate-800 font-bold"}>
                              {t.actual_departure ? new Date(t.actual_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '---'}
                            </div>
                          </td>
                          <td className="px-4 py-4 font-mono font-semibold text-slate-700 text-base tabular-nums">
                            <div className="text-slate-500 text-xs line-through">KH: {new Date(t.scheduled_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                            <div className={t.actual_arrival ? "text-green-600 font-bold" : "text-slate-800 font-bold"}>
                              {t.actual_arrival ? new Date(t.actual_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '---'}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge status={t.status} />
                          </td>
                          <td className="px-4 py-4 text-right">
                            {isScheduled && (
                              <div className="inline-flex flex-col items-end">
                                <button
                                  onClick={() => setConfirm({ open: true, type: 'start', trip: t })}
                                  disabled={!canStart}
                                  className={`font-bold px-6 py-3 rounded-xl text-sm transition border ${
                                    canStart
                                      ? 'bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-md shadow-blue-500/10 cursor-pointer'
                                      : 'bg-slate-100 text-slate-400 border-slate-200 shadow-none cursor-not-allowed'
                                  }`}
                                >
                                  Bắt đầu chuyến
                                </button>
                                {!canStart && (
                                  <span className="text-xs text-amber-600 font-bold mt-1 bg-amber-50 px-2 py-1 rounded border border-amber-100 tabular-nums">
                                    Chờ đến {new Date(t.scheduled_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            )}
                            {isRunning && (
                              <button
                                onClick={() => setConfirm({ open: true, type: 'finish', trip: t })}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition shadow-md shadow-green-500/10 border border-transparent"
                              >
                                Hoàn thành chuyến
                              </button>
                            )}
                            {t.status === 'completed' && (
                              <span className="text-sm font-bold text-slate-400">
                                Đã xong {t.delay_minutes > 0 && <span className="text-amber-600">(Trễ {t.delay_minutes}p)</span>}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirm.open}
        title={confirm.type === 'start' ? 'Ghi nhận xuất bến' : 'Ghi nhận cập bến'}
        message={
          confirm.type === 'start'
            ? `Bạn có chắc chắn muốn ghi nhận xuất bến cho Chuyến #${confirm.trip?.trip_order} không? Hành động này sẽ bắt đầu chuyến xe.`
            : `Bạn có chắc chắn muốn ghi nhận hoàn thành cập bến cho Chuyến #${confirm.trip?.trip_order} không?`
        }
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirm({ open: false, type: '', trip: null })}
        danger={false}
      />
    </Layout>
  );
}
