import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, ConfirmDialog, AlertBox } from '../../components/UI';
import { getRoutes, generateSchedule } from '../../services/routeService';
import routeDriverService from '../../services/routeDriverService';
import { getDrivers } from '../../services/driverService';
import { getRouteBuses, addBusToRoute, removeBusFromRoute } from '../../services/routeBusService';
import { getBuses } from '../../services/busService';

export default function RouteDriverManage() {
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
  const [addBusId, setAddBusId] = useState('');
  const [addBusRole, setAddBusRole] = useState('operating');
  const [addError, setAddError] = useState('');

  const [confirm, setConfirm] = useState({ open: false, type: '', item: null });

  useEffect(() => {
    Promise.all([getRoutes(), getDrivers(), getBuses()])
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
      setAddBusId('');
      setAddBusRole('operating');
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
      setSuccessMsg(`Thêm ${addDriverIds.length} tài xế thành công`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setAddError(err.response?.data?.message || 'Lỗi khi thêm tài xế');
    }
  };

  const handleAddBus = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!selectedRoute || !addBusId) {
      setAddError('Vui lòng chọn xe buýt');
      return;
    }
    try {
      await addBusToRoute(selectedRoute.route_code, { bus_id: Number(addBusId), bus_role: addBusRole });
      setAddBusId('');
      setAddBusRole('operating');
      loadRouteData(selectedRoute.route_code);
      setSuccessMsg('Thêm xe buýt thành công');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setAddError(err.response?.data?.message || 'Lỗi khi thêm xe buýt');
    }
  };



  const [generating, setGenerating] = useState(false);

  const handleGenerateSchedule = async () => {
    if (!selectedRoute) return;
    if (!window.confirm('Hành động này sẽ sinh lịch và phân công cho 60 ngày tiếp theo. Có thể mất một chút thời gian. Bạn có muốn tiếp tục?')) return;
    setGenerating(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await generateSchedule(selectedRoute.route_code);
      setSuccessMsg(res.data.message || 'Sinh lịch thành công!');
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
      } else {
        await removeBusFromRoute(selectedRoute.route_code, confirm.item.bus_id);
      }
      loadRouteData(selectedRoute.route_code);
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
              const rtt = Number(selectedRoute.round_trip_time_minutes || 0);
              const headway = Number(selectedRoute.headway_minutes || 1);
              
              // 1. Calculate Drivers
              const baseBuses = (headway > 0 && rtt > 0) ? Math.ceil(rtt / headway) : 0;
              const mainShifts = baseBuses * 2;
              const standbyCount = Math.ceil(mainShifts * (Number(selectedRoute.standby_ratio) || 0.15));
              const requiredDriversDaily = mainShifts + standbyCount;
              const minWeeklyDrivers = Math.ceil((requiredDriversDaily * 7) / 6);

              // 2. Calculate Buses
              const requiredOperatingBuses = Number(selectedRoute.confirmed_operating_buses || 0);
              const requiredStandbyBuses = selectedRoute.standby_buses_count !== undefined 
                ? Number(selectedRoute.standby_buses_count) 
                : Math.ceil(requiredOperatingBuses * (Number(selectedRoute.backup_bus_ratio) || 0.20));
              const requiredTotalBuses = requiredOperatingBuses + requiredStandbyBuses;

              const unassignedDrivers = drivers.filter(d => d.status === 'working' && !routeDrivers.some(rd => rd.driver_id === d.driver_id));

              const isReady = routeDrivers.length >= minWeeklyDrivers && routeBuses.length >= requiredTotalBuses;

              return (
              <>
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  <div className="border-b px-6 py-4 flex justify-between items-center bg-gray-50">
                     <div className="flex gap-4">
                        <button onClick={() => setActiveTab('drivers')} className={`font-semibold pb-1 border-b-2 ${activeTab === 'drivers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>Tài xế ({routeDrivers.length}/{minWeeklyDrivers})</button>
                        <button onClick={() => setActiveTab('buses')} className={`font-semibold pb-1 border-b-2 ${activeTab === 'buses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>Xe Buýt ({routeBuses.length}/{requiredTotalBuses})</button>
                     </div>
                     <button
                        onClick={handleGenerateSchedule}
                        disabled={generating || !isReady}
                        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${isReady && !generating ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
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
                          <div className="text-2xl font-bold text-blue-700">{routeDrivers.length} / {minWeeklyDrivers}</div>
                        </div>

                        <form onSubmit={handleAddDriver} className="flex gap-4 items-start">
                          <div className="flex-1 space-y-1">
                            <div className="w-full border rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50">
                              {unassignedDrivers.length === 0 ? (
                                <div className="text-sm text-gray-500 text-center py-2">Hết tài xế rảnh</div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {unassignedDrivers.map(d => (
                                    <label key={d.driver_id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded">
                                      <input type="checkbox" checked={addDriverIds.includes(d.driver_id)} onChange={(e) => setAddDriverIds(e.target.checked ? [...addDriverIds, d.driver_id] : addDriverIds.filter(id => id !== d.driver_id))} className="rounded text-blue-600 w-4 h-4"/>
                                      <span className="text-sm text-gray-700">{d.full_name} <span className="text-gray-400">({d.phone})</span></span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                            {addError && activeTab === 'drivers' && <p className="text-red-500 text-sm">{addError}</p>}
                          </div>
                          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Thêm</button>
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
                              {routeDrivers.map(rd => (
                                <tr key={rd.route_driver_id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-900">{rd.full_name}</td>
                                  <td className="px-4 py-3">{rd.phone}</td>
                                  <td className="px-4 py-3 text-right">
                                    <button onClick={() => setConfirm({ open: true, type: 'driver', item: rd })} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium">Gỡ</button>
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
                          <div className="text-2xl font-bold text-emerald-700">{routeBuses.length} / {requiredTotalBuses}</div>
                        </div>

                        <form onSubmit={handleAddBus} className="flex gap-4 items-end">
                          <div className="flex-1 space-y-1">
                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Chọn xe *</label>
                            <select
                              value={addBusId}
                              onChange={e => setAddBusId(e.target.value)}
                              required
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                              <option value="">-- Chọn xe buýt khả dụng --</option>
                              {buses.filter(b => b.status === 'active' && !routeBuses.some(rb => rb.bus_id === b.bus_id)).map(b => (
                                <option key={b.bus_id} value={b.bus_id}>
                                  {b.license_plate} ({b.seat_count} chỗ)
                                </option>
                              ))}
                            </select>
                            {addError && activeTab === 'buses' && <p className="text-red-500 text-sm mt-1">{addError}</p>}
                          </div>
                          <div className="w-48 space-y-1">
                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Vai trò *</label>
                            <select
                              value={addBusRole}
                              onChange={e => setAddBusRole(e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                              <option value="operating">Xe vận doanh</option>
                              <option value="standby">Xe dự phòng</option>
                            </select>
                          </div>
                          <button type="submit" className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium whitespace-nowrap">Thêm xe</button>
                        </form>

                        {dataLoading ? <div className="text-center text-gray-500 py-4">Đang tải...</div> : (
                          <table className="w-full text-left text-sm text-gray-600 border">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="px-4 py-3 font-medium">Biển số</th>
                                <th className="px-4 py-3 font-medium">Sức chứa</th>
                                <th className="px-4 py-3 font-medium">Vai trò</th>
                                <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {routeBuses.map(rb => (
                                <tr key={rb.route_bus_id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-900">{rb.license_plate}</td>
                                  <td className="px-4 py-3">{rb.seat_count} chỗ</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${rb.bus_role === 'operating' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                                      {rb.bus_role === 'operating' ? 'Vận doanh' : 'Dự phòng'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button onClick={() => setConfirm({ open: true, type: 'bus', item: rb })} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium">Gỡ</button>
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
    </Layout>
  );
}
