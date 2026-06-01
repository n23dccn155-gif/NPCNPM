import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, Modal, AlertBox, ConfirmDialog } from '../../components/UI';
import {
  createRouteDirection,
  getRoute,
  getRoutes,
  updateRouteDirection
} from '../../services/routeService';
import { createStop, deleteStop, getStops, updateStop } from '../../services/stopService';

const emptyDirectionForm = {
  start_point: '',
  end_point: '',
  distance_km: '',
  travel_time_minutes: '',
  turnaround_time_minutes: 15
};

export default function DirectionStopManage() {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [directions, setDirections] = useState([]);
  const [stopsByDir, setStopsByDir] = useState({});
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showStopModal, setShowStopModal] = useState(false);
  const [stopMode, setStopMode] = useState('add');
  const [targetDirectionId, setTargetDirectionId] = useState(null);
  const [editingStop, setEditingStop] = useState(null);
  const [stopForm, setStopForm] = useState({
    stop_name: '',
    stop_order: '',
    minute_from_start: ''
  });
  const [stopError, setStopError] = useState('');

  const [showDirectionModal, setShowDirectionModal] = useState(false);
  const [editingDirection, setEditingDirection] = useState(null);
  const [targetDirectionType, setTargetDirectionType] = useState('outbound');
  const [directionForm, setDirectionForm] = useState(emptyDirectionForm);
  const [directionError, setDirectionError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState({ open: false, stop: null });

  const hasOutbound = directions.some(d => d.direction_type === 'outbound');
  const hasInbound = directions.some(d => d.direction_type === 'inbound');

  const loadRoutes = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await getRoutes();
      const routeData = res.data?.data || res.data || [];
      setRoutes(routeData);
      if (!selectedRoute && routeData.length > 0) {
        setSelectedRoute(routeData[0]);
      }
    } catch {
      setErrorMsg('Không thể tải danh sách tuyến');
    } finally {
      setLoading(false);
    }
  };

  const loadRouteDetail = async (routeCode) => {
    setDetailLoading(true);
    setErrorMsg('');
    try {
      const res = await getRoute(routeCode);
      const data = res.data?.data || res.data || {};
      const dirs = data.directions || [];
      const nextStops = {};

      for (const direction of dirs) {
        const stopsRes = await getStops(direction.direction_id);
        nextStops[direction.direction_id] = stopsRes.data?.data || stopsRes.data || [];
      }

      setDirections(dirs);
      setStopsByDir(nextStops);
    } catch {
      setErrorMsg('Không thể tải chi tiết hướng tuyến và điểm dừng');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  useEffect(() => {
    if (selectedRoute) {
      loadRouteDetail(selectedRoute.route_code);
    }
  }, [selectedRoute]);

  const openAddDirection = (directionType) => {
    setEditingDirection(null);
    setTargetDirectionType(directionType);
    setDirectionForm(emptyDirectionForm);
    setDirectionError('');
    setShowDirectionModal(true);
  };

  const openEditDirection = (direction) => {
    setEditingDirection(direction);
    setTargetDirectionType(direction.direction_type);
    setDirectionForm({
      start_point: direction.start_point || '',
      end_point: direction.end_point || '',
      distance_km: direction.distance_km || '',
      travel_time_minutes: direction.travel_time_minutes || '',
      turnaround_time_minutes: direction.turnaround_time_minutes ?? 15
    });
    setDirectionError('');
    setShowDirectionModal(true);
  };

  const handleDirectionSubmit = async (e) => {
    e.preventDefault();
    setDirectionError('');

    if (
      !directionForm.start_point.trim() ||
      !directionForm.end_point.trim() ||
      !directionForm.distance_km ||
      !directionForm.travel_time_minutes ||
      directionForm.turnaround_time_minutes === ''
    ) {
      setDirectionError('Vui lòng nhập đầy đủ thông tin hướng tuyến');
      return;
    }

    const payload = {
      start_point: directionForm.start_point.trim(),
      end_point: directionForm.end_point.trim(),
      distance_km: directionForm.distance_km ? Number(directionForm.distance_km) : null,
      travel_time_minutes: Number(directionForm.travel_time_minutes),
      turnaround_time_minutes: Number(directionForm.turnaround_time_minutes)
    };

    try {
      if (editingDirection) {
        await updateRouteDirection(selectedRoute.route_code, editingDirection.direction_id, payload);
        setSuccessMsg('Cập nhật hướng tuyến thành công');
      } else {
        await createRouteDirection(selectedRoute.route_code, {
          direction_type: targetDirectionType,
          ...payload
        });
        setSuccessMsg('Thêm hướng tuyến thành công');
      }

      setShowDirectionModal(false);
      loadRouteDetail(selectedRoute.route_code);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setDirectionError(err.response?.data?.message || 'Không thể lưu hướng tuyến');
    }
  };

  const openAddStop = (directionId) => {
    const existingStops = stopsByDir[directionId] || [];
    const nextOrder = existingStops.length > 0
      ? Math.max(...existingStops.map(s => s.stop_order)) + 1
      : 1;

    setStopMode('add');
    setTargetDirectionId(directionId);
    setEditingStop(null);
    setStopForm({
      stop_name: '',
      stop_order: nextOrder,
      minute_from_start: ''
    });
    setStopError('');
    setShowStopModal(true);
  };

  const openEditStop = (stop) => {
    setStopMode('edit');
    setTargetDirectionId(stop.direction_id);
    setEditingStop(stop);
    setStopForm({
      stop_name: stop.stop_name,
      stop_order: stop.stop_order,
      minute_from_start: stop.minute_from_start
    });
    setStopError('');
    setShowStopModal(true);
  };

  const handleStopSubmit = async (e) => {
    e.preventDefault();
    setStopError('');

    if (!stopForm.stop_name.trim() || !stopForm.stop_order || stopForm.minute_from_start === '') {
      setStopError('Vui lòng nhập đầy đủ thông tin điểm dừng');
      return;
    }

    const payload = {
      direction_id: targetDirectionId,
      stop_order: Number(stopForm.stop_order),
      stop_name: stopForm.stop_name.trim(),
      minute_from_start: Number(stopForm.minute_from_start)
    };

    try {
      if (stopMode === 'add') {
        await createStop(payload);
        setSuccessMsg('Thêm điểm dừng thành công');
      } else {
        await updateStop(editingStop.stop_id, payload);
        setSuccessMsg('Cập nhật điểm dừng thành công');
      }

      setShowStopModal(false);
      loadRouteDetail(selectedRoute.route_code);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setStopError(err.response?.data?.message || 'Không thể lưu điểm dừng');
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteStop(confirmDelete.stop.stop_id);
      setConfirmDelete({ open: false, stop: null });
      setSuccessMsg('Đã xóa điểm dừng thành công');
      loadRouteDetail(selectedRoute.route_code);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể xóa điểm dừng');
      setConfirmDelete({ open: false, stop: null });
    }
  };

  if (loading) {
    return <Layout><div className="text-center py-12 text-gray-500">Đang tải tuyến...</div></Layout>;
  }

  return (
    <Layout>
      <PageHeader
        title="Quản lý hướng tuyến & điểm dừng"
        subtitle="Tách riêng lượt đi, lượt về và các điểm dừng theo đúng thiết kế CSDL"
      />

      {errorMsg && <div className="mb-4"><AlertBox type="error" message={errorMsg} /></div>}
      {successMsg && <div className="mb-4"><AlertBox type="success" message={successMsg} /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800">Danh sách tuyến</h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-50">
              {routes.map(route => (
                <button
                  key={route.route_code}
                  onClick={() => setSelectedRoute(route)}
                  className={`w-full text-left px-5 py-3.5 transition-all ${selectedRoute?.route_code === route.route_code
                      ? 'bg-blue-50 border-l-4 border-blue-600'
                      : 'hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="font-mono font-bold text-sm text-slate-800">Tuyến {route.route_code}</span>
                      <div className="text-xs text-slate-500 mt-0.5">{route.route_name}</div>
                    </div>
                    <StatusBadge status={route.status} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 space-y-6">
          {selectedRoute ? (
            <>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">
                    Tuyến {selectedRoute.route_code}: {selectedRoute.route_name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Thời gian hoạt động: {selectedRoute.start_time?.slice(0, 5)} - {selectedRoute.end_time?.slice(0, 5)}
                  </p>
                </div>
                <StatusBadge status={selectedRoute.status} />
              </div>

              {(!hasOutbound || !hasInbound) && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-amber-800 font-semibold">
                    Tuyến này chưa có đủ lượt đi/lượt về. Cần tạo đủ 2 hướng trước khi lập kế hoạch vận doanh.
                  </div>
                  <div className="flex gap-2">
                    {!hasOutbound && (
                      <button onClick={() => openAddDirection('outbound')} className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">
                        + Thêm lượt đi
                      </button>
                    )}
                    {!hasInbound && (
                      <button onClick={() => openAddDirection('inbound')} className="px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-bold">
                        + Thêm lượt về
                      </button>
                    )}
                  </div>
                </div>
              )}

              {detailLoading ? (
                <div className="text-center py-16 text-slate-400 font-semibold animate-pulse bg-white rounded-2xl border">
                  Đang tải thông tin hướng tuyến...
                </div>
              ) : directions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center text-slate-400 font-semibold">
                  Chưa có hướng tuyến nào. Hãy thêm lượt đi và lượt về cho tuyến này.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {directions.map(direction => {
                    const stops = stopsByDir[direction.direction_id] || [];
                    const isOutbound = direction.direction_type === 'outbound';

                    return (
                      <div key={direction.direction_id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                        <div className={`p-4 border-b ${isOutbound ? 'bg-blue-50/50 border-blue-100' : 'bg-green-50/50 border-green-100'}`}>
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <span className={`px-2 py-0.5 rounded-lg text-2xs font-bold uppercase ${isOutbound ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                              }`}>
                              {isOutbound ? 'Lượt đi' : 'Lượt về'}
                            </span>
                            <button
                              onClick={() => openEditDirection(direction)}
                              className="text-2xs font-bold text-blue-600 hover:text-blue-800 bg-white px-2 py-1 rounded-lg border border-slate-100 transition"
                            >
                              Sửa hướng
                            </button>
                          </div>
                          <div className="font-bold text-slate-800 text-sm mt-1">
                            {direction.start_point} - {direction.end_point}
                          </div>
                          <div className="flex justify-between text-2xs text-slate-500 font-semibold mt-2 pt-2 border-t border-slate-100">
                            <div>Cự ly: {direction.distance_km || '?'} km</div>
                            <div>Hành trình: {direction.travel_time_minutes} phút</div>
                            <div>Quay đầu: {direction.turnaround_time_minutes} phút</div>
                          </div>
                        </div>

                        <div className="p-4 flex-1">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-slate-700">Điểm dừng ({stops.length})</span>
                            <button
                              onClick={() => openAddStop(direction.direction_id)}
                              className="text-2xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1.5 rounded-lg transition"
                            >
                              + Thêm điểm
                            </button>
                          </div>

                          {stops.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed">
                              Chưa có điểm dừng nào cho lượt này.
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                              {stops.map(stop => (
                                <div key={stop.stop_id} className="flex items-center justify-between bg-slate-50 hover:bg-slate-100/70 p-3 rounded-xl border border-slate-100 transition">
                                  <div className="flex items-center gap-3">
                                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-2xs font-bold font-mono">
                                      {stop.stop_order}
                                    </span>
                                    <div>
                                      <div className="text-xs font-bold text-slate-800">{stop.stop_name}</div>
                                      <div className="text-2xs text-slate-400 font-medium mt-0.5">Phút từ điểm đầu: {stop.minute_from_start} phút</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => openEditStop(stop)} className="text-slate-500 hover:text-slate-700 text-xs font-bold">
                                      Sửa
                                    </button>
                                    <button onClick={() => setConfirmDelete({ open: true, stop })} className="text-red-500 hover:text-red-700 text-xs font-bold">
                                      Xóa
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center text-slate-400 font-semibold">
              Vui lòng chọn tuyến xe từ danh sách bên trái.
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showStopModal} title={stopMode === 'add' ? 'Thêm điểm dừng mới' : 'Cập nhật điểm dừng'} onClose={() => setShowStopModal(false)}>
        <form onSubmit={handleStopSubmit} className="space-y-4">
          {stopError && <AlertBox type="error" message={stopError} />}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Tên điểm dừng *</label>
            <input
              type="text"
              value={stopForm.stop_name}
              onChange={e => setStopForm({ ...stopForm, stop_name: e.target.value })}
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Thứ tự dừng *</label>
              <input
                type="number"
                value={stopForm.stop_order}
                onChange={e => setStopForm({ ...stopForm, stop_order: e.target.value })}
                required
                min="1"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Phút từ điểm đầu *</label>
              <input
                type="number"
                value={stopForm.minute_from_start}
                onChange={e => setStopForm({ ...stopForm, minute_from_start: e.target.value })}
                required
                min="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-3">
            <button type="button" onClick={() => setShowStopModal(false)} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition">
              Hủy
            </button>
            <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md transition shadow-blue-500/10">
              Lưu lại
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showDirectionModal}
        title={`${editingDirection ? 'Cập nhật' : 'Thêm'} ${targetDirectionType === 'outbound' ? 'lượt đi' : 'lượt về'}`}
        onClose={() => setShowDirectionModal(false)}
      >
        <form onSubmit={handleDirectionSubmit} className="space-y-4">
          {directionError && <AlertBox type="error" message={directionError} />}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Điểm đầu *</label>
              <input
                type="text"
                value={directionForm.start_point}
                onChange={e => setDirectionForm({ ...directionForm, start_point: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Điểm cuối *</label>
              <input
                type="text"
                value={directionForm.end_point}
                onChange={e => setDirectionForm({ ...directionForm, end_point: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Cự ly (km) *</label>
              <input
                type="number"
                step="0.1"
                value={directionForm.distance_km}
                onChange={e => setDirectionForm({ ...directionForm, distance_km: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Thời gian hành trình (phút) *</label>
              <input
                type="number"
                value={directionForm.travel_time_minutes}
                onChange={e => setDirectionForm({ ...directionForm, travel_time_minutes: e.target.value })}
                required
                min="1"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Thời gian quay đầu (phút) *</label>
              <input
                type="number"
                value={directionForm.turnaround_time_minutes}
                onChange={e => setDirectionForm({ ...directionForm, turnaround_time_minutes: e.target.value })}
                required
                min="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-3">
            <button type="button" onClick={() => setShowDirectionModal(false)} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition">
              Hủy
            </button>
            <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md transition shadow-blue-500/10">
              Lưu hướng tuyến
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete.open}
        title="Xóa điểm dừng?"
        message={`Bạn có chắc muốn xóa điểm dừng "${confirmDelete.stop?.stop_name}" khỏi hướng tuyến này?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete({ open: false, stop: null })}
        danger
      />
    </Layout>
  );
}
