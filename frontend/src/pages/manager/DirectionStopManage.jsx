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
      setErrorMsg('Khong the tai danh sach tuyen');
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
      setErrorMsg('Khong the tai chi tiet huong tuyen va diem dung');
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
      !directionForm.travel_time_minutes ||
      directionForm.turnaround_time_minutes === ''
    ) {
      setDirectionError('Vui long nhap day du thong tin huong tuyen');
      return;
    }

    const payload = {
      start_point: directionForm.start_point.trim(),
      end_point: directionForm.end_point.trim(),
      travel_time_minutes: Number(directionForm.travel_time_minutes),
      turnaround_time_minutes: Number(directionForm.turnaround_time_minutes)
    };

    try {
      if (editingDirection) {
        await updateRouteDirection(selectedRoute.route_code, editingDirection.direction_id, payload);
        setSuccessMsg('Cap nhat huong tuyen thanh cong');
      } else {
        await createRouteDirection(selectedRoute.route_code, {
          direction_type: targetDirectionType,
          ...payload
        });
        setSuccessMsg('Them huong tuyen thanh cong');
      }

      setShowDirectionModal(false);
      loadRouteDetail(selectedRoute.route_code);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setDirectionError(err.response?.data?.message || 'Khong the luu huong tuyen');
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
      setStopError('Vui long nhap day du thong tin diem dung');
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
        setSuccessMsg('Them diem dung thanh cong');
      } else {
        await updateStop(editingStop.stop_id, payload);
        setSuccessMsg('Cap nhat diem dung thanh cong');
      }

      setShowStopModal(false);
      loadRouteDetail(selectedRoute.route_code);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setStopError(err.response?.data?.message || 'Khong the luu diem dung');
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteStop(confirmDelete.stop.stop_id);
      setConfirmDelete({ open: false, stop: null });
      setSuccessMsg('Da xoa diem dung thanh cong');
      loadRouteDetail(selectedRoute.route_code);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Khong the xoa diem dung');
      setConfirmDelete({ open: false, stop: null });
    }
  };

  if (loading) {
    return <Layout><div className="text-center py-12 text-gray-500">Dang tai tuyen...</div></Layout>;
  }

  return (
    <Layout>
      <PageHeader
        title="Quan ly huong tuyen & diem dung"
        subtitle="Tach rieng luot di, luot ve va cac diem dung theo dung thiet ke CSDL"
      />

      {errorMsg && <div className="mb-4"><AlertBox type="error" message={errorMsg} /></div>}
      {successMsg && <div className="mb-4"><AlertBox type="success" message={successMsg} /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800">Danh sach tuyen</h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-50">
              {routes.map(route => (
                <button
                  key={route.route_code}
                  onClick={() => setSelectedRoute(route)}
                  className={`w-full text-left px-5 py-3.5 transition-all ${
                    selectedRoute?.route_code === route.route_code
                      ? 'bg-blue-50 border-l-4 border-blue-600'
                      : 'hover:bg-slate-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="font-mono font-bold text-sm text-slate-800">Tuyen {route.route_code}</span>
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
                    Tuyen {selectedRoute.route_code}: {selectedRoute.route_name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Thoi gian hoat dong: {selectedRoute.start_time?.slice(0, 5)} - {selectedRoute.end_time?.slice(0, 5)}
                  </p>
                </div>
                <StatusBadge status={selectedRoute.status} />
              </div>

              {(!hasOutbound || !hasInbound) && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-amber-800 font-semibold">
                    Tuyen nay chua co du luot di/luot ve. Can tao du 2 huong truoc khi lap ke hoach van doanh.
                  </div>
                  <div className="flex gap-2">
                    {!hasOutbound && (
                      <button onClick={() => openAddDirection('outbound')} className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">
                        + Them luot di
                      </button>
                    )}
                    {!hasInbound && (
                      <button onClick={() => openAddDirection('inbound')} className="px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-bold">
                        + Them luot ve
                      </button>
                    )}
                  </div>
                </div>
              )}

              {detailLoading ? (
                <div className="text-center py-16 text-slate-400 font-semibold animate-pulse bg-white rounded-2xl border">
                  Dang tai thong tin huong tuyen...
                </div>
              ) : directions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center text-slate-400 font-semibold">
                  Chua co huong tuyen nao. Hay them luot di va luot ve cho tuyen nay.
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
                            <span className={`px-2 py-0.5 rounded-lg text-2xs font-bold uppercase ${
                              isOutbound ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {isOutbound ? 'Luot di (outbound)' : 'Luot ve (inbound)'}
                            </span>
                            <button
                              onClick={() => openEditDirection(direction)}
                              className="text-2xs font-bold text-blue-600 hover:text-blue-800 bg-white px-2 py-1 rounded-lg border border-slate-100 transition"
                            >
                              Sua huong
                            </button>
                          </div>
                          <div className="font-bold text-slate-800 text-sm mt-1">
                            {direction.start_point} - {direction.end_point}
                          </div>
                          <div className="flex justify-between text-2xs text-slate-500 font-semibold mt-2 pt-2 border-t border-slate-100">
                            <div>Hanh trinh: {direction.travel_time_minutes}p</div>
                            <div>Quay dau: {direction.turnaround_time_minutes}p</div>
                          </div>
                        </div>

                        <div className="p-4 flex-1">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-slate-700">Diem dung ({stops.length})</span>
                            <button
                              onClick={() => openAddStop(direction.direction_id)}
                              className="text-2xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1.5 rounded-lg transition"
                            >
                              + Them diem
                            </button>
                          </div>

                          {stops.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed">
                              Chua co diem dung nao cho luot nay.
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
                                      <div className="text-2xs text-slate-400 font-medium mt-0.5">Phut tu diem dau: {stop.minute_from_start}p</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => openEditStop(stop)} className="text-slate-500 hover:text-slate-700 text-xs font-bold">
                                      Sua
                                    </button>
                                    <button onClick={() => setConfirmDelete({ open: true, stop })} className="text-red-500 hover:text-red-700 text-xs font-bold">
                                      Xoa
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
              Vui long chon tuyen xe tu danh sach ben trai.
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showStopModal} title={stopMode === 'add' ? 'Them diem dung moi' : 'Cap nhat diem dung'} onClose={() => setShowStopModal(false)}>
        <form onSubmit={handleStopSubmit} className="space-y-4">
          {stopError && <AlertBox type="error" message={stopError} />}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Ten diem dung *</label>
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
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Thu tu dung *</label>
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
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Phut tu diem dau *</label>
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
              Huy
            </button>
            <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md transition shadow-blue-500/10">
              Luu lai
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showDirectionModal}
        title={`${editingDirection ? 'Cap nhat' : 'Them'} ${targetDirectionType === 'outbound' ? 'luot di' : 'luot ve'}`}
        onClose={() => setShowDirectionModal(false)}
      >
        <form onSubmit={handleDirectionSubmit} className="space-y-4">
          {directionError && <AlertBox type="error" message={directionError} />}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Diem dau *</label>
              <input
                type="text"
                value={directionForm.start_point}
                onChange={e => setDirectionForm({ ...directionForm, start_point: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Diem cuoi *</label>
              <input
                type="text"
                value={directionForm.end_point}
                onChange={e => setDirectionForm({ ...directionForm, end_point: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Thoi gian hanh trinh (phut) *</label>
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
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Thoi gian quay dau (phut) *</label>
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
              Huy
            </button>
            <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md transition shadow-blue-500/10">
              Luu huong tuyen
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete.open}
        title="Xoa diem dung?"
        message={`Ban co chac muon xoa diem dung "${confirmDelete.stop?.stop_name}" khoi huong tuyen nay?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete({ open: false, stop: null })}
        danger
      />
    </Layout>
  );
}
