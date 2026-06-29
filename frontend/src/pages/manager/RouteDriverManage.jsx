import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { formatDate } from '../../utils/format';
import { PageHeader, ConfirmDialog, AlertBox, Modal } from '../../components/UI';
import { getRoutes, generateSchedule, getLatestScheduledDate } from '../../services/routeService';
import routeDriverService from '../../services/routeDriverService';
import { getDrivers } from '../../services/driverService';
import { getRouteBuses, addBusToRoute, removeBusFromRoute } from '../../services/routeBusService';
import { getBuses } from '../../services/busService';

export default function RouteDriverManage() {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [buses, setBuses] = useState([]);
  
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [activeTab, setActiveTab] = useState('drivers'); // 'drivers' | 'buses'

  const [routeDrivers, setRouteDrivers] = useState([]);
  const [routeBuses, setRouteBuses] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add forms
  const [addDriverIds, setAddDriverIds] = useState([]);
  const [addBusIds, setAddBusIds] = useState([]);
  const [addError, setAddError] = useState('');

  const [confirm, setConfirm] = useState({ open: false, type: '', item: null });

  useEffect(() => {
    Promise.all([
      getRoutes(),
      getDrivers({ exclude_assigned: true }),
      getBuses({ exclude_assigned: true })
    ])
      .then(([routeRes, driverRes, busRes]) => {
        const routeData = routeRes.data?.data || routeRes.data || [];
        setRoutes(routeData);
        setDrivers(driverRes.data?.data || driverRes.data || []);
        setBuses(busRes.data?.data || busRes.data || []);
        if (routeData.length > 0) {
          setSelectedRoute(routeData[0]);
        }
      })
      .catch(() => setError('Không thể tải dữ liệu'))
      .finally(() => setLoading(false));
  }, []);

  const loadRouteData = async (routeCode) => {
    setDataLoading(true);
    try {
      const [rdRes, rbRes] = await Promise.all([
        routeDriverService.getRouteDrivers(routeCode),
        getRouteBuses(routeCode).catch(() => ({ data: [] }))
      ]);
      setRouteDrivers(rdRes.data || []);
      setRouteBuses(rbRes.data?.data || rbRes.data || []);
    } catch {
      setRouteDrivers([]);
      setRouteBuses([]);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRoute) {
      setAddDriverIds([]);
      setAddBusIds([]);
      setAddError('');
      loadRouteData(selectedRoute.route_code);
    }
  }, [selectedRoute]);

  const handleAddDriver = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!selectedRoute || addDriverIds.length === 0) {
      setAddError('Vui lòng chọn ít nhất một tài xế');
      return;
    }
    try {
      await Promise.all(addDriverIds.map(id => routeDriverService.addDriverToRoute(selectedRoute.route_code, id)));
      setAddDriverIds([]);
      loadRouteData(selectedRoute.route_code);
      // Re-fetch unassigned drivers
      const driverRes = await getDrivers({ exclude_assigned: true });
      setDrivers(driverRes.data?.data || driverRes.data || []);
      setSuccessMsg(`Thêm ${addDriverIds.length} tài xế thành công`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setAddError(err.response?.data?.message || 'Lỗi khi thêm tài xế');
    }
  };

  const handleAddBus = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!selectedRoute || addBusIds.length === 0) {
      setAddError('Vui lòng chọn ít nhất một xe buýt');
      return;
    }
    try {
      await Promise.all(addBusIds.map(id => addBusToRoute(selectedRoute.route_code, { bus_id: id, bus_role: 'operating' })));
      setAddBusIds([]);
      loadRouteData(selectedRoute.route_code);
      // Re-fetch unassigned buses
      const busRes = await getBuses({ exclude_assigned: true });
      setBuses(busRes.data?.data || busRes.data || []);
      setSuccessMsg(`Thêm ${addBusIds.length} xe buýt thành công`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setAddError(err.response?.data?.message || 'Lỗi khi thêm xe buýt');
    }
  };

  const [generating, setGenerating] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ startDate: new Date().toISOString().split('T')[0], cycles: 1 });
  const [latestDate, setLatestDate] = useState(null);
  const [isCheckingOverlap, setIsCheckingOverlap] = useState(false);

  const openScheduleModal = async () => {
    setShowScheduleModal(true);
    setIsCheckingOverlap(true);
    setLatestDate(null);
    try {
      const res = await getLatestScheduledDate(selectedRoute.route_code);
      if (res.data?.data?.latest_date) {
        setLatestDate(res.data.data.latest_date);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingOverlap(false);
    }
  };

  const handleGenerateSchedule = async (e) => {
    if (e) e.preventDefault();
    if (!selectedRoute) return;
    setGenerating(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await generateSchedule(selectedRoute.route_code, scheduleForm);
      setSuccessMsg('Đã sinh lịch trình nháp thành công! Hệ thống đang chuyển hướng tới trang Lịch biểu...');
      setTimeout(() => {
        setShowScheduleModal(false);
        navigate('/dispatcher/calendar', {
          state: {
            routeCode: selectedRoute.route_code,
            date: scheduleForm.startDate,
            viewMode: 'draft'
          }
        });
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi sinh lịch');
    } finally {
      setGenerating(false);
    }
  };

  const handleRemove = async () => {
    try {
      if (confirm.type === 'driver') {
        await routeDriverService.removeDriverFromRoute(selectedRoute.route_code, confirm.item.driver_id);
        loadRouteData(selectedRoute.route_code);
        // Re-fetch unassigned drivers
        const driverRes = await getDrivers({ exclude_assigned: true });
        setDrivers(driverRes.data?.data || driverRes.data || []);
      } else {
        await removeBusFromRoute(selectedRoute.route_code, confirm.item.bus_id);
        loadRouteData(selectedRoute.route_code);
        // Re-fetch unassigned buses
        const busRes = await getBuses({ exclude_assigned: true });
        setBuses(busRes.data?.data || busRes.data || []);
      }
      setConfirm({ open: false, type: '', item: null });
      setSuccessMsg('Đã gỡ thành công');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi gỡ');
      setTimeout(() => setError(''), 3000);
    }
  };

  if (loading) return <Layout><div className="p-6 text-center text-gray-500">Đang tải dữ liệu...</div></Layout>;

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader title="Quản lý Nguồn lực Tuyến (Tài xế & Xe Buýt)" />
        {error && <AlertBox type="error" message={error} />}
        {successMsg && <AlertBox type="success" message={successMsg} />}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
            <h2 className="font-semibold text-gray-800">Chọn tuyến buýt</h2>
            <div className="space-y-2">
              {routes.map(r => (
                <button
                  key={r.route_code}
                  onClick={() => setSelectedRoute(r)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    selectedRoute?.route_code === r.route_code ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{r.route_code}</div>
                  <div className="text-sm opacity-80">{r.route_name}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {selectedRoute ? (() => {
              const outboundTravel = Number(selectedRoute.outbound_travel_time_minutes || 0);
              const inboundTravel = Number(selectedRoute.inbound_travel_time_minutes || 0);
              const shortLayover = Number(selectedRoute.short_layover_minutes || 0);
              const headway = Number(selectedRoute.headway_minutes || 1);
              const minRestTime = Number(selectedRoute.min_rest_time_minutes || 60);
              const rtt = outboundTravel + inboundTravel + (shortLayover * 2);
              const baseBuses = (headway > 0 && rtt > 0) ? Math.ceil(rtt / headway) : 0;
              
              const requiredRecoveryBuses = headway > 0 ? Math.ceil(minRestTime / headway) : 0;
              const suggestedOperatingBuses = baseBuses + requiredRecoveryBuses;
              const requiredBackupBuses = Math.ceil(suggestedOperatingBuses * Number(selectedRoute.backup_bus_ratio || 0));
              const requiredTotalBuses = suggestedOperatingBuses + requiredBackupBuses;

              const mainShifts = baseBuses * 2;
              const standbyCount = Math.ceil(mainShifts * Number(selectedRoute.standby_ratio || 0));
              const requiredDriversDaily = mainShifts + standbyCount;
              const minWeeklyDrivers = Math.ceil((requiredDriversDaily * 7) / 6);

              const unassignedDrivers = drivers.filter(d => d.status === 'working' && !routeDrivers.some(rd => rd.driver_id === d.driver_id));
              const unassignedBuses = buses.filter(b => b.status === 'active' && !routeBuses.some(rb => rb.bus_id === b.bus_id));

              const selectedNewDrivers = addDriverIds.map(id => drivers.find(d => d.driver_id === id)).filter(Boolean);
              const combinedDrivers = [
                ...selectedNewDrivers.map(nd => ({ ...nd, isSaved: false, route_driver_id: `new-${nd.driver_id}` })),
                ...routeDrivers.map(rd => ({ ...rd, isSaved: true }))
              ];

              const selectedNewBuses = addBusIds.map(id => buses.find(b => b.bus_id === id)).filter(Boolean);
              const combinedBuses = [
                ...selectedNewBuses.map(nb => ({ ...nb, isSaved: false, route_bus_id: `new-${nb.bus_id}` })),
                ...routeBuses.map(rb => ({ ...rb, isSaved: true }))
              ];

              const isDriverLimitReached = routeDrivers.length + addDriverIds.length >= minWeeklyDrivers;
              const isBusLimitReached = routeBuses.length + addBusIds.length >= requiredTotalBuses;

              const isReady = routeDrivers.length >= minWeeklyDrivers && routeBuses.length >= requiredTotalBuses;

              return (
              <>
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                   <div className="border-b px-6 py-4 flex justify-between items-center bg-gray-50">
                      <div className="flex gap-4">
                         <button onClick={() => setActiveTab('drivers')} className={`font-semibold pb-1 border-b-2 ${activeTab === 'drivers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>Tài xế ({routeDrivers.length}{addDriverIds.length > 0 ? ` + ${addDriverIds.length}` : ''}/{minWeeklyDrivers})</button>
                         <button onClick={() => setActiveTab('buses')} className={`font-semibold pb-1 border-b-2 ${activeTab === 'buses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>Xe Buýt ({routeBuses.length}{addBusIds.length > 0 ? ` + ${addBusIds.length}` : ''}/{requiredTotalBuses})</button>
                      </div>
                      <button
                        onClick={openScheduleModal}
                        disabled={generating || !isReady}
                        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${isReady && !generating ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                      >
                        {generating ? 'Đang sinh lịch...' : 'Sẵn sàng xếp lịch'}
                      </button>
                  </div>
                  
                  <div className="p-6">
                    {activeTab === 'drivers' && (
                      <div className="space-y-6">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-blue-800">Tiêu chuẩn Tài xế</div>
                            <div className="text-sm text-blue-600">Tuyển tối thiểu để xoay vòng nghỉ 1 ngày/tuần</div>
                          </div>
                          <div className="text-2xl font-bold text-blue-700">{routeDrivers.length + addDriverIds.length} / {minWeeklyDrivers}</div>
                        </div>

                        <form onSubmit={handleAddDriver} className="flex gap-4 items-start">
                          <div className="flex-1 space-y-1">
                            <div className="w-full border rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50">
                              {unassignedDrivers.length === 0 ? (
                                <div className="text-sm text-gray-500 text-center py-2">Hết tài xế rảnh</div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {unassignedDrivers.map(d => {
                                    const isChecked = addDriverIds.includes(d.driver_id);
                                    const isDisabled = isDriverLimitReached && !isChecked;
                                    return (
                                      <label key={d.driver_id} className={`flex items-center gap-2 p-1.5 rounded ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100'}`}>
                                        <input 
                                          type="checkbox" 
                                          checked={isChecked} 
                                          disabled={isDisabled}
                                          onChange={(e) => setAddDriverIds(e.target.checked ? [...addDriverIds, d.driver_id] : addDriverIds.filter(id => id !== d.driver_id))} 
                                          className="rounded text-blue-600 w-4 h-4 disabled:opacity-50"
                                        />
                                        <span className="text-sm text-gray-700">{d.full_name} <span className="text-gray-400">({d.phone})</span></span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {addError && activeTab === 'drivers' && <p className="text-red-500 text-sm">{addError}</p>}
                          </div>
                          <button type="submit" disabled={addDriverIds.length === 0} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed">Lưu</button>
                        </form>

                        {dataLoading ? <div className="text-center text-gray-500 py-4">Đang tải...</div> : (
                          <table className="w-full text-left text-sm text-gray-600 border">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="px-4 py-3 font-medium">Họ tên</th>
                                <th className="px-4 py-3 font-medium">Số điện thoại</th>
                                <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {combinedDrivers.map(rd => (
                                <tr key={rd.route_driver_id} className={`hover:bg-gray-50 ${!rd.isSaved ? 'bg-blue-50/40' : ''}`}>
                                  <td className="px-4 py-3 font-medium text-gray-900">
                                    <div className="flex items-center gap-2">
                                      {rd.full_name}
                                      {!rd.isSaved && (
                                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800 uppercase tracking-wide">Mới (Chưa lưu)</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">{rd.phone}</td>
                                  <td className="px-4 py-3 text-right">
                                    {rd.isSaved ? (
                                      <button onClick={() => setConfirm({ open: true, type: 'driver', item: rd })} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium">Gỡ</button>
                                    ) : (
                                      <button onClick={() => setAddDriverIds(addDriverIds.filter(id => id !== rd.driver_id))} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium">Bỏ chọn</button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {activeTab === 'buses' && (
                      <div className="space-y-6">
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-emerald-800">Tiêu chuẩn Xe Buýt</div>
                            <div className="text-sm text-emerald-600">Tổng xe cần thiết (bao gồm vận doanh và dự phòng)</div>
                          </div>
                          <div className="text-2xl font-bold text-emerald-700">{routeBuses.length + addBusIds.length} / {requiredTotalBuses}</div>
                        </div>

                        <form onSubmit={handleAddBus} className="flex gap-4 items-start">
                          <div className="flex-1 space-y-1">
                            <div className="w-full border rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50">
                              {unassignedBuses.length === 0 ? (
                                <div className="text-sm text-gray-500 text-center py-2">Hết xe buýt rảnh</div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {unassignedBuses.map(b => {
                                    const isChecked = addBusIds.includes(b.bus_id);
                                    const isDisabled = isBusLimitReached && !isChecked;
                                    return (
                                      <label key={b.bus_id} className={`flex items-center gap-2 p-1.5 rounded ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100'}`}>
                                        <input 
                                          type="checkbox" 
                                          checked={isChecked} 
                                          disabled={isDisabled}
                                          onChange={(e) => setAddBusIds(e.target.checked ? [...addBusIds, b.bus_id] : addBusIds.filter(id => id !== b.bus_id))} 
                                          className="rounded text-emerald-600 w-4 h-4 disabled:opacity-50"
                                        />
                                        <span className="text-sm text-gray-700">{b.license_plate} <span className="text-gray-400">({b.seat_count} chỗ)</span></span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {addError && activeTab === 'buses' && <p className="text-red-500 text-sm">{addError}</p>}
                          </div>
                          <button type="submit" disabled={addBusIds.length === 0} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed">Lưu</button>
                        </form>

                        {dataLoading ? <div className="text-center text-gray-500 py-4">Đang tải...</div> : (
                          <table className="w-full text-left text-sm text-gray-600 border">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="px-4 py-3 font-medium">Biển số</th>
                                <th className="px-4 py-3 font-medium">Sức chứa</th>
                                <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {combinedBuses.map(rb => (
                                <tr key={rb.route_bus_id} className={`hover:bg-gray-50 ${!rb.isSaved ? 'bg-emerald-50/40' : ''}`}>
                                  <td className="px-4 py-3 font-medium text-gray-900">
                                    <div className="flex items-center gap-2">
                                      {rb.license_plate}
                                      {!rb.isSaved && (
                                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 uppercase tracking-wide">Mới (Chưa lưu)</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">{rb.seat_count} chỗ</td>
                                  <td className="px-4 py-3 text-right">
                                    {rb.isSaved ? (
                                      <button onClick={() => setConfirm({ open: true, type: 'bus', item: rb })} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium">Gỡ</button>
                                    ) : (
                                      <button onClick={() => setAddBusIds(addBusIds.filter(id => id !== rb.bus_id))} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium">Bỏ chọn</button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )})() : (
              <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
                Vui lòng chọn một tuyến buýt bên trái
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirm.open}
        title={`Xác nhận gỡ ${confirm.type === 'driver' ? 'tài xế' : 'xe buýt'}`}
        message={`Bạn có chắc chắn muốn gỡ khỏi tuyến?`}
        onConfirm={handleRemove}
        onCancel={() => setConfirm({ open: false, type: '', item: null })}
      />

      <Modal isOpen={showScheduleModal} onClose={() => !generating && setShowScheduleModal(false)} title="Cấu hình Xếp lịch tự động">
        <form onSubmit={handleGenerateSchedule} className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            Hệ thống sử dụng thuật toán <strong className="text-gray-900">Tua ca (Rotating Shift)</strong>. 
            Một chu kỳ tương đương với khoảng thời gian để toàn bộ tài xế hiện có luân phiên hết tất cả các khung giờ chạy.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
            <input 
              type="date" 
              required
              disabled={generating || isCheckingOverlap}
              value={scheduleForm.startDate}
              onChange={e => setScheduleForm({...scheduleForm, startDate: e.target.value})}
              className={`w-full border p-2 rounded-lg ${(latestDate && new Date(scheduleForm.startDate) <= new Date(latestDate)) ? 'border-red-500 bg-red-50' : ''}`}
            />
            {latestDate && new Date(scheduleForm.startDate) <= new Date(latestDate) && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded-lg">
                <span className="font-semibold">Cảnh báo:</span> Ngày bắt đầu này bị trùng với lịch đã xếp trước đó. 
                Vui lòng chọn từ ngày <strong>{(() => {
                  const d = new Date(latestDate);
                  d.setDate(d.getDate() + 1);
                  return formatDate(d);
                })()}</strong> trở đi.
                <button 
                  type="button"
                  onClick={() => {
                    const d = new Date(latestDate);
                    d.setDate(d.getDate() + 1);
                    setScheduleForm({...scheduleForm, startDate: d.toISOString().split('T')[0]});
                  }}
                  className="ml-2 font-medium underline text-red-700 hover:text-red-900"
                >
                  Dùng ngày gợi ý
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng chu kỳ muốn xếp</label>
            <input 
              type="number" 
              required min="1"
              disabled={generating}
              value={scheduleForm.cycles}
              onChange={e => setScheduleForm({...scheduleForm, cycles: parseInt(e.target.value)})}
              className="w-full border p-2 rounded-lg"
            />
          </div>
          {scheduleForm.startDate && scheduleForm.cycles > 0 && routeDrivers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc dự kiến</label>
              <div className="w-full border border-gray-200 p-2 rounded-lg bg-gray-50 text-gray-700 font-medium">
                {(() => {
                  const numDays = scheduleForm.cycles * routeDrivers.length;
                  const endDate = new Date(scheduleForm.startDate);
                  endDate.setDate(endDate.getDate() + numDays - 1);
                  return formatDate(endDate);
                })()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Tổng cộng: {scheduleForm.cycles * routeDrivers.length} ngày (với {routeDrivers.length} tài xế hiện tại)</p>
            </div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowScheduleModal(false)} disabled={generating} className="px-4 py-2 text-gray-600 font-medium">Hủy</button>
            <button type="submit" disabled={generating || isCheckingOverlap || (latestDate && new Date(scheduleForm.startDate) <= new Date(latestDate))} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {generating ? 'Đang xử lý...' : 'Sinh lịch trình & Phân ca'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
