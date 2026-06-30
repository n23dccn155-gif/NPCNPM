import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { formatDate } from '../../utils/format';
import { PageHeader, AlertBox, ConfirmDialog } from '../../components/UI';
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

  useEffect(() => {
    if (!user) return;

    const eventSource = new EventSource('http://localhost:5000/api/realtime/events');
    
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'ASSIGNMENT_UPDATED') {
          const isAffected = 
            payload.data.new_driver_user_id === user.id ||
            payload.data.old_driver_user_id === user.id ||
            payload.data.driver_user_id === user.id ||
            payload.data.action === 'auto_assign';
          
          if (isAffected) {
            setSuccessMsg('Có thay đổi phân công ca chạy của bạn. Đang cập nhật lịch trình...');
            setTimeout(() => setSuccessMsg(''), 5000);
            loadMyTrips();
          }
        } else if (payload.type === 'TRIP_STATUS_CHANGED') {
          if (payload.data.driver_user_id === user.id || !payload.data.driver_user_id) {
            if (payload.data.status === 'cancelled') {
              setErrorMsg(`⚠️ Chuyến xe #${payload.data.trip_order || ''} của bạn đã bị hủy.`);
              setTimeout(() => setErrorMsg(''), 6000);
            } else {
              setSuccessMsg(`Cập nhật trạng thái chuyến xe: ${payload.data.status === 'running' ? 'Đang chạy' : 'Hoàn thành'}.`);
              setTimeout(() => setSuccessMsg(''), 4000);
            }
            loadMyTrips();
          }
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
  }, [user]);

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

  const getStatusText = (status) => {
    switch (status) {
      case 'assigned':
      case 'scheduled': return 'Chờ xuất bến';
      case 'running': return 'Đang chạy';
      case 'completed': return 'Đã hoàn thành';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'assigned':
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
            📭 Bạn không có ca chạy nào được phân công trong ngày {formatDate(filterDate)}.
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

            {/* Table of individual trips for this driver */}
            <div className="space-y-4">
              <h4 className="font-bold text-slate-900 text-sm tracking-wide uppercase">Lộ trình các chuyến</h4>
              
              <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Chuyến</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Xe Buýt</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Lộ trình</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Xuất bến KH</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Cập bến KH</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Xuất bến Thực tế</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Cập bến Thực tế</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                      <th className="px-5 py-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trips.map((t) => {
                      const isScheduled = t.status === 'scheduled' || t.status === 'assigned';
                      const isRunning = t.status === 'running';
                      const scheduledDep = new Date(t.scheduled_departure);
                      const canStart = currentTime >= scheduledDep;

                      return (
                        <tr key={t.trip_id} className="hover:bg-slate-50/50 transition">
                          <td className="px-5 py-4 font-mono font-bold text-slate-800">
                            Chuyến #{t.trip_order}
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-md font-mono border border-slate-200">
                              {t.license_plate || 'Chưa xếp'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-800 text-sm">
                              {t.start_point} &rarr; {t.end_point}
                            </div>
                            <div className="text-3xs font-semibold text-slate-400 mt-0.5">
                              {t.direction_type === 'outbound' ? 'Lượt đi' : 'Lượt về'}
                            </div>
                          </td>
                          <td className="px-5 py-4 font-mono font-semibold text-slate-600 text-sm">
                            {new Date(t.scheduled_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-5 py-4 font-mono font-semibold text-slate-600 text-sm">
                            {new Date(t.scheduled_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm">
                            {t.actual_departure ? (
                              <span className="text-green-600 font-bold">
                                {new Date(t.actual_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-bold">&mdash;&mdash;</span>
                            )}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm">
                            {t.actual_arrival ? (
                              <span className="text-green-600 font-bold">
                                {new Date(t.actual_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-bold">&mdash;&mdash;</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-2xs font-bold border ${getStatusColor(t.status)}`}>
                              {getStatusText(t.status)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            {isScheduled && (
                              <div className="inline-flex flex-col items-end">
                                <button
                                  onClick={() => setConfirm({ open: true, type: 'start', trip: t })}
                                  disabled={!canStart}
                                  className={`font-bold px-3 py-1.5 rounded-lg text-2xs transition border ${
                                    canStart
                                      ? 'bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-md shadow-blue-500/10 cursor-pointer'
                                      : 'bg-slate-100 text-slate-400 border-slate-200 shadow-none cursor-not-allowed'
                                  }`}
                                >
                                  Xuất bến
                                </button>
                                {!canStart && (
                                  <span className="text-4xs text-amber-600 font-bold mt-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                    Chờ đến {new Date(t.scheduled_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            )}
                            {isRunning && (
                              <button
                                onClick={() => setConfirm({ open: true, type: 'finish', trip: t })}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg text-2xs transition shadow-md shadow-green-500/10 border border-transparent"
                              >
                                Cập bến
                              </button>
                            )}
                            {t.status === 'completed' && (
                              <span className="text-xs font-bold text-slate-400">
                                Hoàn thành {t.delay_minutes > 0 && `(Trễ ${t.delay_minutes}p)`}
                              </span>
                            )}
                            {t.status === 'cancelled' && (
                              <span className="text-xs font-bold text-red-500">
                                Đã hủy
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
