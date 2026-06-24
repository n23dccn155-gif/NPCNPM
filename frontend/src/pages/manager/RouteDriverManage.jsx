import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, ConfirmDialog, AlertBox } from '../../components/UI';
import { getRoutes, generateSchedule } from '../../services/routeService';
import routeDriverService from '../../services/routeDriverService';
import { getDrivers } from '../../services/driverService';

export default function RouteDriverManage() {
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeDrivers, setRouteDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rdLoading, setRdLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add driver form
  const [addDriverIds, setAddDriverIds] = useState([]);
  const [addError, setAddError] = useState('');

  // Confirm delete
  const [confirm, setConfirm] = useState({ open: false, rd: null });

  useEffect(() => {
    Promise.all([getRoutes(), getDrivers()])
      .then(([routeRes, driverRes]) => {
        const routeData = routeRes.data?.data || routeRes.data || [];
        setRoutes(routeData);
        setDrivers(driverRes.data?.data || driverRes.data || []);
        if (routeData.length > 0) {
          setSelectedRoute(routeData[0]);
        }
      })
      .catch(() => setError('Không thể tải dữ liệu'))
      .finally(() => setLoading(false));
  }, []);

  const loadRouteDrivers = async (routeCode) => {
    setRdLoading(true);
    try {
      const res = await routeDriverService.getRouteDrivers(routeCode);
      setRouteDrivers(res.data || []);
    } catch {
      setRouteDrivers([]);
    } finally {
      setRdLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRoute) loadRouteDrivers(selectedRoute.route_code);
  }, [selectedRoute]);

  const handleAddDriver = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!selectedRoute || addDriverIds.length === 0) {
      setAddError('Vui lòng chọn tuyến và ít nhất một tài xế');
      return;
    }

    try {
      await Promise.all(
        addDriverIds.map(id => routeDriverService.addDriverToRoute(selectedRoute.route_code, id))
      );
      setAddDriverIds([]);
      loadRouteDrivers(selectedRoute.route_code);
      setSuccessMsg(`Thêm ${addDriverIds.length} tài xế vào tuyến thành công`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setAddError(err.response?.data?.message || 'Lỗi khi thêm tài xế (có thể một số tài xế đã thuộc tuyến này)');
    }
  };

  
  const [generating, setGenerating] = useState(false);

  const handleGenerateSchedule = async () => {
    if (!selectedRoute) return;
    if (!window.confirm('Hành động này sẽ sinh lịch và phân công xoay vòng cho 60 ngày tiếp theo. Có thể mất một chút thời gian. Bạn có muốn tiếp tục?')) return;
    
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

  const handleRemoveDriver = async () => {
    try {
      await routeDriverService.removeDriverFromRoute(selectedRoute.route_code, confirm.rd.driver_id);
      loadRouteDrivers(selectedRoute.route_code);
      setConfirm({ open: false, rd: null });
      setSuccessMsg('Đã gỡ tài xế khỏi tuyến');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi gỡ tài xế');
      setTimeout(() => setError(''), 3000);
    }
  };

  if (loading) return <Layout><div className="p-6 text-center text-gray-500">Đang tải dữ liệu...</div></Layout>;

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader title="Quản lý Tài xế theo Tuyến" />
        {error && <AlertBox type="error" message={error} />}
        {successMsg && <AlertBox type="success" message={successMsg} />}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left panel: Route list */}
          <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
            <h2 className="font-semibold text-gray-800">Chọn tuyến buýt</h2>
            <div className="space-y-2">
              {routes.map(r => (
                <button
                  key={r.route_code}
                  onClick={() => setSelectedRoute(r)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    selectedRoute?.route_code === r.route_code
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{r.route_code}</div>
                  <div className="text-sm opacity-80">{r.route_name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Right panel: Route Drivers */}
          <div className="lg:col-span-3 space-y-6">
            {selectedRoute ? (() => {
              const mainShifts = selectedRoute.confirmed_operating_buses * 2;
              const standbyCount = Math.ceil(mainShifts * Number(selectedRoute.standby_ratio));
              const requiredDriversDaily = mainShifts + standbyCount;
              const minWeeklyDrivers = Math.ceil((requiredDriversDaily * 7) / 6);
              const unassignedDrivers = drivers.filter(d => 
                d.status === 'working' && 
                !routeDrivers.some(rd => rd.driver_id === d.driver_id)
              );

              return (
              <>
                <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
                  <div className="flex justify-between items-end border-b pb-2">
                    <h2 className="font-semibold text-gray-800 text-lg">
                      Thêm tài xế vào tuyến {selectedRoute.route_code}
                    </h2>
                    <div className="text-sm text-blue-600 font-medium text-right">
                      Tuyến cần tối thiểu {minWeeklyDrivers} tài xế (để xoay vòng nghỉ 1 ngày/tuần)
                      <br/>
                      Đã có {routeDrivers.length}
                    </div>
                  </div>
                  <form onSubmit={handleAddDriver} className="flex gap-4 items-start">
                    <div className="flex-1 space-y-1">
                      <div className="w-full border rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50">
                        {unassignedDrivers.length === 0 ? (
                          <div className="text-sm text-gray-500 text-center py-2">Tất cả tài xế đang làm việc đều đã được thêm vào tuyến</div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {unassignedDrivers.map(d => (
                              <label key={d.driver_id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded">
                                <input
                                  type="checkbox"
                                  checked={addDriverIds.includes(d.driver_id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setAddDriverIds([...addDriverIds, d.driver_id]);
                                    } else {
                                      setAddDriverIds(addDriverIds.filter(id => id !== d.driver_id));
                                    }
                                  }}
                                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                />
                                <span className="text-sm text-gray-700">{d.full_name} <span className="text-gray-400">({d.phone})</span></span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      {addError && <p className="text-red-500 text-sm">{addError}</p>}
                    </div>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap"
                    >
                      Thêm vào tuyến
                    </button>
                  </form>
                </div>

                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    
                    <h2 className="font-semibold text-gray-800">
                      Danh sách Tài xế tuyến {selectedRoute.route_code} ({routeDrivers.length})
                    </h2>
                    <button
                      onClick={handleGenerateSchedule}
                      disabled={generating || routeDrivers.length === 0}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                      {generating ? 'Đang sinh lịch...' : 'Sinh lịch 2 tháng'}
                    </button>

                  </div>
                  {rdLoading ? (
                    <div className="p-8 text-center text-gray-500">Đang tải danh sách...</div>
                  ) : routeDrivers.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Tuyến chưa được bố trí tài xế nào</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-3 font-medium">ID</th>
                            <th className="px-4 py-3 font-medium">Họ tên</th>
                            <th className="px-4 py-3 font-medium">Số điện thoại</th>
                            <th className="px-4 py-3 font-medium">Bằng lái</th>
                            <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {routeDrivers.map(rd => (
                            <tr key={rd.route_driver_id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">{rd.driver_id}</td>
                              <td className="px-4 py-3 font-medium text-gray-900">{rd.full_name}</td>
                              <td className="px-4 py-3">{rd.phone}</td>
                              <td className="px-4 py-3">{rd.license_class}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => setConfirm({ open: true, rd })}
                                  className="text-red-600 hover:text-red-900 px-2 py-1 bg-red-50 rounded text-xs font-medium"
                                >
                                  Gỡ khỏi tuyến
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
        title="Xác nhận gỡ tài xế"
        message={`Bạn có chắc chắn muốn gỡ tài xế ${confirm.rd?.full_name} khỏi tuyến ${selectedRoute?.route_code}?`}
        onConfirm={handleRemoveDriver}
        onCancel={() => setConfirm({ open: false, rd: null })}
      />
    </Layout>
  );
}
