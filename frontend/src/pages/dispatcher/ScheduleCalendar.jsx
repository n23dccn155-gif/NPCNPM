import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import { formatDate } from '../../utils/format';
import { PageHeader, AlertBox, Modal } from '../../components/UI';
import { getRoutes } from '../../services/routeService';
import { getPlans, getPlan, submitPlan, deletePlan } from '../../services/planService';
import { clearDriver, replaceDriver } from '../../services/assignmentService';
import { getBuses, updateBusStatus } from '../../services/busService';
import { cancelTrip } from '../../services/tripService';

export default function ScheduleCalendar() {
  const location = useLocation();
  const initialRoute = location.state?.routeCode || null;
  const initialDate = location.state?.date || new Date().toISOString().split('T')[0];
  const initialViewMode = location.state?.viewMode || 'approved';

  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(initialRoute);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [viewMode, setViewMode] = useState(initialViewMode); // 'approved' | 'draft'

  const [loading, setLoading] = useState(true);
  const [planDetail, setPlanDetail] = useState(null);
  const [busPool, setBusPool] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [highlightedDriver, setHighlightedDriver] = useState(null);
  const [cancelModal, setCancelModal] = useState({ open: false, trip: null, reason: '' });
  const [cancelError, setCancelError] = useState('');
  const [deleteModal, setDeleteModal] = useState({ open: false, planId: null, dateStr: '' });
  const [submitModal, setSubmitModal] = useState({ open: false, planId: null, dateStr: '' });

  // Fetch active routes
  useEffect(() => {
    getRoutes({ status: 'active' })
      .then((res) => {
        const data = res.data?.data || res.data || [];
        setRoutes(data);
        if (data.length > 0 && !selectedRoute) setSelectedRoute(data[0].route_code);
      })
      .catch(() => setError('Lỗi khi tải danh sách tuyến'))
      .finally(() => setLoading(false));
  }, []);

  const stateRef = useRef();
  stateRef.current = { selectedRoute, selectedDate, planDetail, viewMode };

  const loadAllData = () => {
    const { selectedRoute: route, selectedDate: date, viewMode: mode } = stateRef.current;
    if (!route || !date) return;

    // Fetch buses for this route
    getBuses({ route_code: route })
      .then(res => setBusPool(res.data?.data || res.data || []))
      .catch(console.error);

    const statusFilter = mode === 'approved' ? 'approved' : 'draft,pending_approval,rejected';

    getPlans({ route_code: route, date: date, status: statusFilter })
      .then((res) => {
        const plans = res.data?.data || res.data || [];
        if (plans.length > 0) {
          return getPlan(plans[0].plan_id);
        } else {
          return null; // No plan for this day
        }
      })
      .then((res) => {
        if (res) {
          setPlanDetail(res.data?.data || res.data);
        } else {
          setPlanDetail(null);
        }
      })
      .catch(() => {
        setPlanDetail(null);
      });
  };

  // Fetch plan for selected route and date
  useEffect(() => {
    setPlanDetail(null);
    setBusPool([]);
    setError('');
    loadAllData();
  }, [selectedRoute, selectedDate, viewMode]);

  // Listen to real-time events from manager
  useEffect(() => {
    const eventSource = new EventSource('http://localhost:5000/api/realtime/events');
    
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { selectedRoute: currentRoute, selectedDate: currentDate, planDetail: currentPlan } = stateRef.current;

        if (payload.type === 'PLAN_REVIEWED') {
          const { route_code, operation_date, status } = payload.data;
          const formattedOpDate = operation_date.split('T')[0];
          if (route_code === currentRoute && formattedOpDate === currentDate) {
            setSuccess(`Kế hoạch ngày ${formattedOpDate} đã được ${status === 'approved' ? 'duyệt' : 'từ chối'}!`);
            setTimeout(() => setSuccess(''), 4000);
            loadAllData();
          }
        } else if (payload.type === 'PLAN_BATCH_REVIEWED') {
          if (currentPlan && payload.data.planIds.includes(currentPlan.plan_id)) {
            setSuccess(`Kế hoạch của bạn đã được ${payload.data.status === 'approved' ? 'duyệt' : 'từ chối'} hàng loạt!`);
            setTimeout(() => setSuccess(''), 4000);
            loadAllData();
          }
        } else if (payload.type === 'LEAVE_REQUEST_REVIEWED') {
          const { status, leave_date } = payload.data;
          if (status === 'approved') {
            setSuccess(`Có yêu cầu nghỉ phép ngày ${leave_date.split('T')[0]} vừa được duyệt. Lịch biểu có thể bị ảnh hưởng!`);
            setTimeout(() => setSuccess(''), 6000);
            loadAllData();
          }
        } else if (payload.type === 'TRIP_STATUS_CHANGED') {
          const { plan_id } = payload.data;
          if (currentPlan && plan_id === currentPlan.plan_id) {
            loadAllData();
          }
        } else if (payload.type === 'INCIDENT_REPORTED') {
          const { incident, driver_name } = payload.data;
          setSuccess(`⚠️ CẢNH BÁO SỰ CỐ: Tài xế ${driver_name} báo cáo sự cố "${incident.incident_type}"!`);
          setTimeout(() => setSuccess(''), 6000);
          loadAllData();
        } else if (payload.type === 'ASSIGNMENT_UPDATED') {
          loadAllData();
        } else if (payload.type === 'ROUTE_UPDATED' || payload.type === 'ROUTE_CREATED' || payload.type === 'ROUTE_DELETED') {
          loadAllData();
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
  }, []);


  const openSubmitModal = () => {
    if (!planDetail) return;
    setSubmitModal({ open: true, planId: planDetail.plan_id, dateStr: planDetail.operation_date });
  };

  const handleSubmitPlanAction = async (type) => {
    const planIdToSubmit = submitModal.planId;
    setSubmitModal({ open: false, planId: null, dateStr: '' });
    if (!planIdToSubmit) return;

    setError('');
    setSuccess('');
    try {
      if (type === 'future') {
        await submitPlan(planIdToSubmit, { target: 'future' });
        setSuccess('Đã gửi duyệt cả chu kỳ kế hoạch nháp thành công.');
      } else {
        await submitPlan(planIdToSubmit);
        setSuccess('Gửi duyệt kế hoạch thành công.');
      }
      // Refresh plan details
      const res = await getPlan(planIdToSubmit);
      setPlanDetail(res.data?.data || res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi duyệt');
    }
  };

  const openDeleteModal = () => {
    if (!planDetail) return;
    setDeleteModal({ open: true, planId: planDetail.plan_id, dateStr: planDetail.operation_date });
  };

  const handleDeleteDraftAction = async (type) => {
    const planIdToDelete = deleteModal.planId;
    setDeleteModal({ open: false, planId: null, dateStr: '' });
    if (!planIdToDelete) return;

    setError('');
    setSuccess('');
    try {
      if (type === 'future') {
        await deletePlan(planIdToDelete, { target: 'future' });
        setSuccess('Đã xóa cả chu kỳ kế hoạch nháp thành công.');
      } else {
        await deletePlan(planIdToDelete);
        setSuccess('Đã xóa bản nháp kế hoạch ngày hôm nay thành công.');
      }
      setPlanDetail(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể xóa kế hoạch');
    }
  };

  const handleClearDriver = async (e, groupId) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn gỡ tài xế này khỏi nhóm chuyến?')) return;
    try {
      await clearDriver(groupId);
      // Reload plan
      const res = await getPlan(planDetail.plan_id);
      setPlanDetail(res.data?.data || res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi gỡ tài xế');
    }
  };

  const handleDragStart = (e, driverId) => {
    e.dataTransfer.setData('text/plain', driverId);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // allow drop
  };

  const handleDrop = async (e, groupId) => {
    e.preventDefault();
    const newDriverId = e.dataTransfer.getData('text/plain');
    if (!newDriverId || !groupId) return;

    try {
      await replaceDriver({ group_id: groupId, new_driver_id: newDriverId });
      // Reload plan
      const res = await getPlan(planDetail.plan_id);
      setPlanDetail(res.data?.data || res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi thay thế tài xế');
      console.error(err);
    }
  };

  const handleRestoreBus = async (busId) => {
    if (window.confirm('Bạn có chắc chắn muốn xác nhận xe này đã sửa xong và đưa về trạng thái Hoạt động?')) {
      try {
        await updateBusStatus(busId, 'active');
        // Refresh bus pool
        getBuses({ route_code: selectedRoute })
          .then(res => setBusPool(res.data?.data || res.data || []));
      } catch (err) {
        alert(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái xe');
      }
    }
  };

  const handleCancelClick = (e, trip) => {
    e.stopPropagation();
    setCancelModal({ open: true, trip, reason: '' });
    setCancelError('');
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    setCancelError('');
    if (!cancelModal.reason.trim()) {
      setCancelError('Vui lòng nhập lý do hủy chuyến');
      return;
    }
    try {
      await cancelTrip(cancelModal.trip.trip_id, cancelModal.reason);
      setCancelModal({ open: false, trip: null, reason: '' });
      setSuccess('Đã hủy chuyến xe thành công.');
      setTimeout(() => setSuccess(''), 4000);
      // Reload plan
      if (planDetail?.plan_id) {
        const res = await getPlan(planDetail.plan_id);
        setPlanDetail(res.data?.data || res.data);
      }
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Lỗi khi hủy chuyến xe');
    }
  };

  // Render Daily Timeline
  const renderTimeline = () => {
    if (!planDetail || !planDetail.trips || planDetail.trips.length === 0) {
      return (
        <div className="text-center p-12 bg-white rounded-lg border shadow-sm text-gray-500">
          {viewMode === 'approved'
            ? 'Không có kế hoạch vận doanh chính thức (đã phê duyệt) cho tuyến và ngày này.'
            : 'Chưa có bản nháp kế hoạch nào được tạo cho tuyến và ngày này.'}
        </div>
      );
    }

    const getStatusText = (status) => {
      switch (status) {
        case 'draft': return 'Bản nháp';
        case 'pending_approval': return 'Chờ phê duyệt';
        case 'approved': return 'Đã phê duyệt';
        case 'rejected': return 'Bị từ chối';
        default: return status;
      }
    };

    const getStatusBadge = (status) => {
      switch (status) {
        case 'draft': return 'bg-gray-100 text-gray-700 border border-gray-200';
        case 'pending_approval': return 'bg-amber-100 text-amber-700 border border-amber-200';
        case 'approved': return 'bg-green-100 text-green-700 border border-green-200';
        case 'rejected': return 'bg-red-100 text-red-700 border border-red-200';
        default: return 'bg-gray-100 text-gray-700 border border-gray-200';
      }
    };

    const planHeader = (
      <div className="bg-white p-4 rounded-lg border shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="font-bold text-gray-700 text-sm">Trạng thái kế hoạch ngày:</span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase ${getStatusBadge(planDetail.status)}`}>
            {getStatusText(planDetail.status)}
          </span>
        </div>
        {viewMode === 'draft' && (
          <div className="flex gap-3">
            {(planDetail.status === 'draft' || planDetail.status === 'rejected') && (
              <button
                onClick={openSubmitModal}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow-md shadow-green-500/10"
              >
                Gửi Quản lý duyệt
              </button>
            )}
            {planDetail.status !== 'approved' && (
              <button
                onClick={openDeleteModal}
                className="bg-white hover:bg-red-50 text-red-600 border border-red-200 font-semibold text-xs px-4 py-2 rounded-lg transition"
              >
                Xóa bản nháp
              </button>
            )}
          </div>
        )}
      </div>
    );

    const rejectReasonBanner = planDetail.status === 'rejected' && planDetail.reject_reason ? (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-xs font-semibold flex items-center gap-2">
        <span>Lý do bị từ chối:</span>
        <span className="font-bold">"{planDetail.reject_reason}"</span>
      </div>
    ) : null;


    const leaves = planDetail.approved_leaves || [];
    const isLeaveDriver = (name) => leaves.some(l => l.driver_name === name);

    const leaveAlert = leaves.length > 0 ? (
      <div className="mb-4 bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
        <h3 className="font-bold text-orange-800">Thông tin Nghỉ phép</h3>
        <p className="text-sm text-orange-700">Trạng thái các tài xế xin nghỉ trong ngày:</p>
        <ul className="list-disc list-inside text-sm mt-2 space-y-1">
          {leaves.map(l => {
            if (l.not_scheduled) {
              return (
                <li key={l.leave_id} className="text-gray-500 italic">
                  {l.driver_name} <span className="text-sm">(Có lịch nghỉ nhưng hôm nay không được phân công tuyến này)</span>
                </li>
              );
            } else if (l.replaced_by) {
              return (
                <li key={l.leave_id} className="text-green-700">
                  <span className="font-bold line-through text-gray-500 mr-2">{l.driver_name}</span>
                  đã được thay thế bởi <span className="font-bold">{l.replaced_by}</span>
                </li>
              );
            } else if (l.cleared) {
              return (
                <li key={l.leave_id} className="text-orange-600 font-semibold">
                  {l.driver_name} <span className="font-normal">(Đã gỡ phân công, đang chờ kéo thả tài xế dự bị)</span>
                </li>
              );
            } else {
              return (
                <li key={l.leave_id} className="text-red-600 font-bold">
                  {l.driver_name} <span className="font-normal text-red-500">(Đang được phân công chạy. Vui lòng gỡ [✕] và thay thế!)</span>
                </li>
              );
            }
          })}
        </ul>
      </div>
    ) : null;

    const incidents = planDetail.incidents || [];
    const incidentAlert = incidents.length > 0 ? (
      <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
        <h3 className="font-bold text-red-800">Sự cố trong ngày</h3>
        <ul className="list-disc list-inside text-sm mt-2 space-y-1">
          {incidents.map(i => (
            <li key={i.incident_id} className="text-red-700">
              <span className="font-bold">Xe {i.license_plate || i.bus_id}</span> ({i.incident_type === 'bus_broken' ? 'Hỏng xe' : i.incident_type})
              do tài xế <span className="font-semibold">{i.reported_by_name}</span> báo cáo lúc {
                (() => {
                  const d = new Date(i.created_at);
                  d.setHours(d.getHours() + 7);
                  return d.toLocaleTimeString('vi-VN');
                })()
              }.
              {i.incident_type === 'bus_broken' && ' Thuật toán đã tự động dồn toa bù xe dự phòng vào các chuyến còn lại của ngày.'}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

    const outboundTrips = planDetail.trips.filter(t => t.direction_type === 'outbound');
    const inboundTrips = planDetail.trips.filter(t => t.direction_type === 'inbound');

    const renderTripTable = (trips, title) => (
      <div className="flex-1 bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="bg-gray-50 border-b p-3 font-semibold text-gray-700 text-center">
          {title} ({trips.length} chuyến)
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-3">Giờ xuất bến</th>
                <th className="p-3">Nhóm</th>
                <th className="p-3">Biển số</th>
                <th className="p-3">Tài xế</th>
                <th className="p-3 text-center">Trạng thái</th>
                <th className="p-3 text-center">Trễ</th>
                <th className="p-3 text-center">Hủy</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {trips.map(t => {
                const group = planDetail.groups?.find(g => g.group_id === t.group_id);
                return (
                  <tr
                    key={t.trip_id}
                    className={`hover:bg-gray-50 cursor-pointer transition ${highlightedDriver && group?.driver_name === highlightedDriver ? 'bg-yellow-100' : ''}`}
                    onClick={() => {
                      if (group?.driver_name) {
                        setHighlightedDriver(group.driver_name === highlightedDriver ? null : group.driver_name);
                      }
                    }}
                  >
                    <td className="p-3 font-medium text-blue-700">
                      {t.status === 'cancelled' && <span className="text-red-500 font-bold mr-1">[HỦY]</span>}
                      {t.scheduled_departure ? new Date(t.scheduled_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="p-3">
                      <span className={t.status === 'cancelled' ? 'line-through text-gray-400' : ''}>
                        {t.group_name || '-'}
                      </span>
                    </td>
                    <td className="p-3">{group?.license_plate || <span className="text-red-400">Chưa xếp</span>}</td>
                    <td
                      className={`p-3 ${!group?.driver_name ? 'bg-red-50 outline-dashed outline-1 outline-red-300' : ''}`}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, group?.group_id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={group?.driver_name && isLeaveDriver(group.driver_name) ? 'text-red-600 font-bold' : ''}>
                          {group?.driver_name || <span className="text-red-400">Kéo thả tài xế dự bị...</span>}
                        </span>
                        {group?.driver_name && (
                          <button
                            onClick={(e) => handleClearDriver(e, group.group_id)}
                            className="text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full w-5 h-5 flex items-center justify-center text-xs ml-auto transition"
                            title="Gỡ tài xế"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {t.status === 'completed' ? (
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-200">Hoàn thành</span>
                      ) : t.status === 'running' ? (
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">Đang chạy</span>
                      ) : t.status === 'cancelled' ? (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-200">Đã hủy</span>
                      ) : (
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">Chưa chạy</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {t.delay_minutes > 0 ? (
                        <span className="px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 font-bold text-xs">
                          {t.delay_minutes} phút
                        </span>
                      ) : (
                        <span className="text-gray-500 font-medium">0</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {t.status !== 'completed' && t.status !== 'cancelled' ? (
                        <button
                          onClick={(e) => handleCancelClick(e, t)}
                          className="text-red-600 hover:text-red-800 font-bold hover:bg-red-50 px-2 py-1 rounded text-xs transition"
                        >
                          Hủy
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );

    return (
      <div className="space-y-6">
        {planHeader}
        {rejectReasonBanner}
        {leaveAlert}
        {incidentAlert}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderTripTable(outboundTrips, `Chiều Đi (Từ ${outboundTrips[0]?.start_point || 'A'})`)}
          {renderTripTable(inboundTrips, `Chiều Về (Từ ${inboundTrips[0]?.start_point || 'B'})`)}
        </div>

        {/* Standby Drivers Section */}
        {planDetail.standby_drivers && planDetail.standby_drivers.length > 0 && (
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <div className="bg-orange-50 border-b border-orange-100 p-3 font-semibold text-orange-800 flex items-center gap-2">
              <span>Tài xế Dự bị (Hôm nay)</span>
              <span className="bg-orange-200 text-orange-800 text-xs px-2 py-0.5 rounded-full">
                {planDetail.standby_drivers.length}
              </span>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {planDetail.standby_drivers.map(sd => (
                <div
                  key={sd.assignment_id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, sd.driver_id)}
                  className={`border rounded p-3 flex flex-col gap-1 cursor-grab active:cursor-grabbing transition ${highlightedDriver === sd.driver_name
                      ? 'bg-yellow-100 border-yellow-300 shadow-sm'
                      : 'border-orange-100 bg-orange-50/50 hover:bg-orange-100'
                    }`}
                  onClick={() => setHighlightedDriver(sd.driver_name === highlightedDriver ? null : sd.driver_name)}
                >
                  <div className="font-medium text-gray-900">{sd.driver_name}</div>
                  <div className="text-xs text-gray-500">Ca: {sd.assignment_type === 'standby_morning' ? 'Sáng (đến 13h)' : 'Chiều (từ 13h)'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bus Pool Section */}
        {busPool && busPool.length > 0 && (
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-100 p-3 font-semibold text-blue-800 flex items-center gap-2">
              <span>Pool Xe Tuyến {selectedRoute}</span>
              <span className="bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                {busPool.length}
              </span>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {busPool.map(bus => (
                <div
                  key={bus.bus_id}
                  className={`border rounded p-3 flex flex-col gap-1 transition ${bus.status === 'active' ? 'border-green-200 bg-green-50' :
                      bus.status === 'maintenance' ? 'border-red-200 bg-red-50' :
                        bus.status === 'inactive' ? 'border-gray-200 bg-gray-50' :
                          'border-yellow-200 bg-yellow-50'
                    }`}
                >
                  <div className="font-bold text-gray-900">{bus.license_plate}</div>
                  <div className={`text-xs font-semibold uppercase ${bus.status === 'active' ? 'text-green-600' :
                      bus.status === 'maintenance' ? 'text-red-600' :
                        bus.status === 'inactive' ? 'text-gray-500' :
                          'text-yellow-600'
                    }`}>
                    {bus.status === 'active' ? 'Hoạt động' :
                      bus.status === 'maintenance' ? 'Bảo trì / Hỏng' :
                        bus.status === 'inactive' ? 'Ngưng' : bus.status}
                  </div>
                  {bus.status === 'maintenance' && (
                    <button
                      onClick={() => handleRestoreBus(bus.bus_id)}
                      className="mt-1 bg-white text-xs font-semibold text-blue-600 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50 transition"
                    >
                      Phục hồi xe
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <Layout><div className="p-6">Đang tải...</div></Layout>;

  return (
    <Layout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader title="Lịch biểu Phân công" />
        {error && <AlertBox type="error" message={error} />}
        {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}

        {/* Controls */}
        <div className="bg-white p-4 rounded-lg shadow-sm border flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chọn tuyến buýt</label>
            <select
              value={selectedRoute || ''}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="border rounded-lg px-4 py-2 w-64 bg-gray-50"
            >
              {routes.map(r => (
                <option key={r.route_code} value={r.route_code}>
                  {r.route_code} - {r.route_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chọn ngày</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border rounded-lg px-4 py-2 bg-gray-50 w-48"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái kế hoạch</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="border rounded-lg px-4 py-2 w-64 bg-gray-50 font-medium"
            >
              <option value="approved">Đã phê duyệt (Vận hành)</option>
              <option value="draft">Bản nháp / Chưa duyệt</option>
            </select>
          </div>
        </div>

        {/* Timeline */}
        {renderTimeline()}
      </div>

      {/* Cancel Trip Modal */}
      <Modal isOpen={cancelModal.open} title="Hủy chuyến xe khẩn cấp" onClose={() => setCancelModal({ open: false, trip: null, reason: '' })}>
        {cancelModal.trip && (
          <form onSubmit={handleCancelSubmit} className="space-y-4">
            {cancelError && <AlertBox type="error" message={cancelError} />}

            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl p-3.5 leading-relaxed">
              ⚠️ CẢNH BÁO: Thao tác này sẽ hủy bỏ chuyến xe thứ #{cancelModal.trip.trip_order} thuộc ca chạy "{cancelModal.trip.group_name || 'N/A'}". Một thông báo khẩn sẽ được gửi đến tài xế được phân công chạy chuyến này.
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Lý do hủy chuyến *</label>
              <textarea
                value={cancelModal.reason}
                onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })}
                required
                rows={3}
                placeholder="Nhập lý do chi tiết hủy chuyến (VD: Xe hỏng đột xuất, tắc đường nghiêm trọng...)"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t">
              <button
                type="button"
                onClick={() => setCancelModal({ open: false, trip: null, reason: '' })}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-red-500/10 transition"
              >
                Xác nhận hủy chuyến
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Draft Plan Modal */}
      <Modal 
        isOpen={deleteModal.open} 
        title="Xóa kế hoạch nháp" 
        onClose={() => setDeleteModal({ open: false, planId: null, dateStr: '' })}
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm leading-relaxed">
            Bạn muốn thực hiện thao tác xóa nào cho tuyến <strong>{selectedRoute}</strong> bắt đầu từ ngày <strong>{deleteModal.dateStr ? formatDate(deleteModal.dateStr) : ''}</strong>?
          </p>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3 leading-relaxed">
            ⚠️ Lưu ý: Thao tác xóa kế hoạch nháp sẽ đồng thời xóa toàn bộ thông tin phân công xe, ca chạy và các chuyến xe liên quan.
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={() => handleDeleteDraftAction('single')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition"
            >
              Chỉ xóa ngày hiện tại ({deleteModal.dateStr ? formatDate(deleteModal.dateStr) : ''})
            </button>
            <button
              onClick={() => handleDeleteDraftAction('future')}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition"
            >
              Xóa cả chu kỳ (Từ ngày {deleteModal.dateStr ? formatDate(deleteModal.dateStr) : ''} trở đi)
            </button>
            <button
              onClick={() => setDeleteModal({ open: false, planId: null, dateStr: '' })}
              className="w-full bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-semibold py-2.5 px-4 rounded-xl text-sm transition"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      </Modal>

      {/* Submit Draft Plan Modal */}
      <Modal 
        isOpen={submitModal.open} 
        title="Gửi duyệt kế hoạch" 
        onClose={() => setSubmitModal({ open: false, planId: null, dateStr: '' })}
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm leading-relaxed">
            Bạn muốn thực hiện thao tác gửi duyệt nào cho tuyến <strong>{selectedRoute}</strong> bắt đầu từ ngày <strong>{submitModal.dateStr ? formatDate(submitModal.dateStr) : ''}</strong>?
          </p>
          <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl p-3 leading-relaxed">
            ℹ️ Lưu ý: Khi gửi duyệt, tất cả các nhóm chuyến của kế hoạch phải được phân công xe và tài xế đầy đủ.
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={() => handleSubmitPlanAction('single')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition"
            >
              Chỉ gửi duyệt ngày hiện tại ({submitModal.dateStr ? formatDate(submitModal.dateStr) : ''})
            </button>
            <button
              onClick={() => handleSubmitPlanAction('future')}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition"
            >
              Gửi duyệt cả chu kỳ (Từ ngày {submitModal.dateStr ? formatDate(submitModal.dateStr) : ''} trở đi)
            </button>
            <button
              onClick={() => setSubmitModal({ open: false, planId: null, dateStr: '' })}
              className="w-full bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-semibold py-2.5 px-4 rounded-xl text-sm transition"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
