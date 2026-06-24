import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox } from '../../components/UI';
import { getRoutes } from '../../services/routeService';
import { getPlans, getPlan } from '../../services/planService';
import { clearDriver, replaceDriver } from '../../services/assignmentService';

export default function ScheduleCalendar() {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(true);
  const [planDetail, setPlanDetail] = useState(null);
  const [error, setError] = useState('');
  const [highlightedDriver, setHighlightedDriver] = useState(null);

  // Fetch active routes
  useEffect(() => {
    getRoutes({ status: 'active' })
      .then((res) => {
        const data = res.data?.data || res.data || [];
        setRoutes(data);
        if (data.length > 0) setSelectedRoute(data[0].route_code);
      })
      .catch(() => setError('Lỗi khi tải danh sách tuyến'))
      .finally(() => setLoading(false));
  }, []);

  // Fetch plan for selected route and date
  useEffect(() => {
    if (!selectedRoute || !selectedDate) return;
    
    setPlanDetail(null);
    setError('');

    getPlans({ route_code: selectedRoute, date: selectedDate, status: 'approved' })
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
        }
      })
      .catch(() => {
        // If it fails, maybe there's no plan or network error. Just ignore for now.
      });
  }, [selectedRoute, selectedDate]);

  
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
    }
  };

  // Render Daily Timeline
  const renderTimeline = () => {
    if (!planDetail || !planDetail.trips || planDetail.trips.length === 0) {
      return (
        <div className="text-center p-12 bg-white rounded-lg border shadow-sm text-gray-500">
          Không có kế hoạch vận doanh (hoặc kế hoạch chưa được duyệt) cho tuyến và ngày này.
        </div>
      );
    }

    
    const leaves = planDetail.approved_leaves || [];
    const isLeaveDriver = (name) => leaves.some(l => l.driver_name === name);
    
    const leaveAlert = leaves.length > 0 ? (
      <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
        <h3 className="font-bold text-red-800">Cảnh báo Nghỉ phép</h3>
        <p className="text-sm text-red-700">Các tài xế sau đã được duyệt nghỉ phép vào ngày này. Vui lòng gỡ phân công và kéo thả tài xế dự bị để thay thế:</p>
        <ul className="list-disc list-inside text-sm text-red-600 mt-1">
          {leaves.map(l => <li key={l.leave_id} className="font-semibold">{l.driver_name} (Lý do: {l.reason || 'Không có'})</li>)}
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
                <th className="p-3">Mã nhóm</th>
                <th className="p-3">Biển số</th>
                <th className="p-3">Tài xế</th>
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
                      {t.scheduled_departure ? new Date(t.scheduled_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="p-3">{t.group_name || '-'}</td>
                    <td className="p-3">{group?.license_plate || <span className="text-red-400">Chưa xếp</span>}</td>
                    <td 
                      className={`p-3 ${!group?.driver_name ? 'bg-red-50 outline-dashed outline-1 outline-red-300' : ''}`}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, group?.group_id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={group?.driver_name && isLeaveDriver(group.driver_name) ? 'text-red-600 font-bold' : ''}>
                          {group?.driver_name || <span className="text-red-400">Kéo thả tài xế dự bị vào đây...</span>}
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
        {leaveAlert}
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
                  className={`border rounded p-3 flex flex-col gap-1 cursor-grab active:cursor-grabbing transition ${
                    highlightedDriver === sd.driver_name 
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
      </div>
    );
  };

  if (loading) return <Layout><div className="p-6">Đang tải...</div></Layout>;

  return (
    <Layout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader title="Lịch biểu Phân công" />
        {error && <AlertBox type="error" message={error} />}

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
        </div>

        {/* Timeline */}
        {renderTimeline()}
      </div>
    </Layout>
  );
}
