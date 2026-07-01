import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, ConfirmDialog, Modal, AlertBox } from '../../components/UI';
import { getRoutes, getRoute, createRoute, updateRoute, updateRouteStatus, deleteRoute } from '../../services/routeService';

const emptyForm = {
  route_code: '',
  route_name: '',
  start_time: '05:00',
  end_time: '21:00',
  expected_trips_per_day: 20,
  headway_minutes: 50,
  confirmed_operating_buses: 1,
  status: 'active',
  outbound_start_point: '',
  outbound_end_point: '',
  outbound_distance: '',
  inbound_start_point: '',
  inbound_end_point: '',
  inbound_distance: '',
  outbound_travel_time_minutes: 80,
  inbound_travel_time_minutes: 80,
  short_layover_minutes: 10,
  long_layover_minutes: 15,
  max_driving_minutes: 240,
  standby_ratio: 0.15,
  inbound_start_time: '05:30',
  backup_bus_ratio: 0.20,
  min_rest_time_minutes: 60
};

const toTimeInput = (value, fallback) => value?.slice(0, 5) || fallback;

const timeToMinutes = (value) => {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const calculateHeadway = (start, end, expectedTrips) => {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  const trips = Number(expectedTrips);
  if (startMin === null || endMin === null || endMin <= startMin || trips < 2) return null;
  return (endMin - startMin) / (trips - 1);
};

const formatMinutes = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? `${Number(number.toFixed(2))} phút` : 'Chưa đủ dữ liệu';
};

export default function RouteList() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirm, setConfirm] = useState({ open: false, route: null, newStatus: '' });
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [outboundMiddleStops, setOutboundMiddleStops] = useState([]);
  const [inboundMiddleStops, setInboundMiddleStops] = useState([]);

  const load = async () => {
    try {
      const res = await getRoutes();
      setRoutes(res.data.data);
    } catch {
      setError('Không thể tải danh sách tuyến xe');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const eventSource = new EventSource('http://localhost:5000/api/realtime/events');
    
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (['ROUTE_CREATED', 'ROUTE_UPDATED', 'ROUTE_DELETED'].includes(payload.type)) {
          load();
        }
      } catch (err) {
        console.error('[Realtime] Error processing event in RouteList:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[Realtime] EventSource error in RouteList:', err);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    const handleWheel = (e) => {
      if (document.activeElement && document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
    };
    document.addEventListener('wheel', handleWheel);
    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setOutboundMiddleStops([]);
    setInboundMiddleStops([]);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = async (r) => {
    console.log('Editing route object:', r);
    setEditing(r);
    setForm({
      route_code: r.route_code,
      route_name: r.route_name || '',
      start_time: toTimeInput(r.start_time, '05:00'),
      end_time: toTimeInput(r.end_time, '21:00'),
      expected_trips_per_day: r.expected_trips_per_day ?? 20,
      headway_minutes: r.headway_minutes ?? r.calculated_headway_minutes ?? 50,
      confirmed_operating_buses: r.confirmed_operating_buses ?? 1,
      status: r.status || 'active',
      outbound_start_point: r.outbound_start_point || '',
      outbound_end_point: r.outbound_end_point || '',
      outbound_distance: r.outbound_distance_km || '',
      inbound_start_point: r.inbound_start_point || '',
      inbound_end_point: r.inbound_end_point || '',
      inbound_distance: r.inbound_distance_km ?? '',
      outbound_travel_time_minutes: r.outbound_travel_time_minutes ?? 80,
      inbound_travel_time_minutes: r.inbound_travel_time_minutes ?? 80,
      short_layover_minutes: r.short_layover_minutes ?? 10,
      long_layover_minutes: r.long_layover_minutes ?? 15,
      max_driving_minutes: r.max_driving_minutes ?? 240,
      standby_ratio: r.standby_ratio ?? 0.15,
      inbound_start_time: r.inbound_start_time?.slice(0, 5) || '05:30',
      backup_bus_ratio: r.backup_bus_ratio ?? 0.20,
      min_rest_time_minutes: r.min_rest_time_minutes ?? 60,
    });
    setFormError('');
    setOutboundMiddleStops([]);
    setInboundMiddleStops([]);
    setShowModal(true);

    try {
      const res = await getRoute(r.route_code);
      const fullRoute = res.data?.data || res.data || {};
      const outboundDir = fullRoute.directions?.find(d => d.direction_type === 'outbound');
      const inboundDir = fullRoute.directions?.find(d => d.direction_type === 'inbound');

      const outboundStops = outboundDir?.stops || [];
      const inboundStops = inboundDir?.stops || [];

      const outboundMax = outboundStops.length > 0 ? Math.max(...outboundStops.map(s => s.stop_order)) : 0;
      const outboundMiddles = outboundStops
        .filter(s => s.stop_order > 1 && s.stop_order < outboundMax)
        .sort((a, b) => a.stop_order - b.stop_order)
        .map(s => ({ id: s.stop_id, stop_name: s.stop_name, minute_from_start: s.minute_from_start }));

      const inboundMax = inboundStops.length > 0 ? Math.max(...inboundStops.map(s => s.stop_order)) : 0;
      const inboundMiddles = inboundStops
        .filter(s => s.stop_order > 1 && s.stop_order < inboundMax)
        .sort((a, b) => a.stop_order - b.stop_order)
        .map(s => ({ id: s.stop_id, stop_name: s.stop_name, minute_from_start: s.minute_from_start }));

      setOutboundMiddleStops(outboundMiddles);
      setInboundMiddleStops(inboundMiddles);
    } catch (err) {
      console.error('Lỗi khi tải chi tiết điểm dừng:', err);
    }
  };

  const buildPayload = () => {
    const startMin = timeToMinutes(form.start_time);
    const inboundStartMin = timeToMinutes(form.inbound_start_time || form.start_time);
    const outboundTravel = Number(form.outbound_travel_time_minutes || 0);
    const inboundTravel = Number(form.inbound_travel_time_minutes || 0);
    const shortLayover = Number(form.short_layover_minutes || 0);
    const headway = Number(form.headway_minutes || 1);
    const minRest = Number(form.min_rest_time_minutes) || 0;

    const firstArrivalAtB = startMin + outboundTravel + shortLayover;
    const requiredBusesB = Math.max(0, Math.ceil((firstArrivalAtB - inboundStartMin) / headway));

    const firstArrivalAtA = inboundStartMin + inboundTravel + shortLayover;
    const requiredBusesA = Math.max(0, Math.ceil((firstArrivalAtA - startMin) / headway));

    const baseBuses = (headway > 0) ? (requiredBusesA + requiredBusesB) : 0;
    const recoveryBuses = headway > 0 ? Math.ceil(minRest / headway) : 0;
    const autoConfirmedBuses = baseBuses + recoveryBuses;

    const outbound_stops = [
      { stop_order: 1, stop_name: (form.outbound_start_point || '').trim(), minute_from_start: 0 },
      ...outboundMiddleStops.map((s, idx) => ({
        stop_order: idx + 2,
        stop_name: (s.stop_name || '').trim(),
        minute_from_start: Number(s.minute_from_start)
      })),
      {
        stop_order: outboundMiddleStops.length + 2,
        stop_name: (form.outbound_end_point || '').trim(),
        minute_from_start: Number(form.outbound_travel_time_minutes)
      }
    ];

    const inbound_stops = [
      { stop_order: 1, stop_name: (form.inbound_start_point || '').trim(), minute_from_start: 0 },
      ...inboundMiddleStops.map((s, idx) => ({
        stop_order: idx + 2,
        stop_name: (s.stop_name || '').trim(),
        minute_from_start: Number(s.minute_from_start)
      })),
      {
        stop_order: inboundMiddleStops.length + 2,
        stop_name: (form.inbound_end_point || '').trim(),
        minute_from_start: Number(form.inbound_travel_time_minutes)
      }
    ];

    return {
      route_name: form.route_name.trim(),
      start_time: form.start_time,
      end_time: form.end_time,
      expected_trips_per_day: Math.floor((timeToMinutes(form.end_time) - timeToMinutes(form.start_time)) / Number(form.headway_minutes)) + 1,
      headway_minutes: Number(form.headway_minutes),
      confirmed_operating_buses: autoConfirmedBuses,
      outbound_start_point: form.outbound_start_point.trim(),
      outbound_end_point: form.outbound_end_point.trim(),
      outbound_distance: form.outbound_distance ? Number(form.outbound_distance) : null,
      inbound_start_point: form.inbound_start_point.trim(),
      inbound_end_point: form.inbound_end_point.trim(),
      inbound_distance: form.inbound_distance ? Number(form.inbound_distance) : null,
      outbound_travel_time_minutes: Number(form.outbound_travel_time_minutes),
      inbound_travel_time_minutes: Number(form.inbound_travel_time_minutes),
      outbound_stops,
      inbound_stops,
      short_layover_minutes: Number(form.short_layover_minutes),
      long_layover_minutes: Number(form.long_layover_minutes),
      max_driving_minutes: Number(form.max_driving_minutes),
      standby_ratio: Number(form.standby_ratio),
      inbound_start_time: form.inbound_start_time,
      backup_bus_ratio: Number(form.backup_bus_ratio),
      min_rest_time_minutes: Number(form.min_rest_time_minutes)
    };
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    if (timeToMinutes(form.end_time) <= timeToMinutes(form.start_time)) {
      setFormError('Giờ kết thúc hoạt động phải sau giờ bắt đầu hoạt động');
      return;
    }
    if (Number(form.headway_minutes) <= 0) {
      setFormError('Giãn cách khai thác phải lớn hơn 0');
      return;
    }
    try {
      if (editing) {
        await updateRoute(editing.route_code, buildPayload());
        if (form.status !== editing.status) {
          await updateRouteStatus(editing.route_code, form.status);
        }
      } else {
        await createRoute({ route_code: form.route_code.trim(), ...buildPayload() });
        if (form.status !== 'active') {
          await updateRouteStatus(form.route_code.trim(), form.status);
        }
      }
      setShowModal(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Lỗi khi lưu tuyến xe');
    }
  };

  const handleStatusChange = async () => {
    try {
      if (confirm.newStatus === 'delete') {
        await deleteRoute(confirm.route.route_code);
      } else {
        await updateRouteStatus(confirm.route.route_code, confirm.newStatus);
      }
      setConfirm({ open: false, route: null, newStatus: '' });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi thực hiện thao tác');
    }
  };

  if (loading) return <Layout><div className="flex justify-center py-12 text-gray-500">Đang tải...</div></Layout>;

  const filtered = routes.filter(r => {
    const matchSearch = !search || r.route_code.toLowerCase().includes(search.toLowerCase()) || r.route_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || r.status === filterStatus;
    return matchSearch && matchStatus;
  });
  const startMin = timeToMinutes(form.start_time);
  const inboundStartMin = timeToMinutes(form.inbound_start_time || form.start_time);
  const outboundTravel = Number(form.outbound_travel_time_minutes || 0);
  const inboundTravel = Number(form.inbound_travel_time_minutes || 0);
  const shortLayover = Number(form.short_layover_minutes || 0);
  const headway = Number(form.headway_minutes || 1);
  const minRest = Number(form.min_rest_time_minutes) || 0;

  const firstArrivalAtB = startMin + outboundTravel + shortLayover;
  const requiredBusesB = Math.max(0, Math.ceil((firstArrivalAtB - inboundStartMin) / headway));

  const firstArrivalAtA = inboundStartMin + inboundTravel + shortLayover;
  const requiredBusesA = Math.max(0, Math.ceil((firstArrivalAtA - startMin) / headway));

  const editingBaseBuses = (headway > 0) ? (requiredBusesA + requiredBusesB) : 0;
  const editingRecoveryBuses = (headway > 0) ? Math.ceil(minRest / headway) : 0;
  const editingSuggestedBuses = editingBaseBuses + editingRecoveryBuses;
  const editingBackupBuses = Math.ceil(editingSuggestedBuses * (Number(form.backup_bus_ratio) || 0));
  const editingTotalBuses = editingSuggestedBuses + editingBackupBuses;

  const mainShifts = editingBaseBuses * 2;
  const standbyCount = Math.ceil(mainShifts * (Number(form.standby_ratio) || 0));
  const dailyDrivers = mainShifts + standbyCount;
  const weeklyDrivers = Math.ceil(dailyDrivers * 7 / 6);

  return (
    <Layout>
      <PageHeader
        title="Quản lý tuyến xe"
        subtitle={`${filtered.length} / ${routes.length} tuyến`}
        action={
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2">
            + Thêm tuyến
          </button>
        }
      />
      {error && <AlertBox type="error" message={error} />}

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo mã tuyến hoặc tên tuyến..."
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Ngưng hoạt động</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã tuyến</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên tuyến</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giờ hoạt động</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giãn cách</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vòng xe</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => (
                <tr key={r.route_code} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-mono font-medium text-gray-900">{r.route_code}</td>
                  <td className="px-6 py-4 text-gray-700">{r.route_name}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{toTimeInput(r.start_time, '--:--')} - {toTimeInput(r.end_time, '--:--')}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {formatMinutes(r.headway_minutes)}
                    {r.calculated_headway_minutes && Math.abs(r.calculated_headway_minutes - r.headway_minutes) > 0.01 && (
                      <span className="text-xs text-gray-400 block">(Tối đa: {formatMinutes(r.calculated_headway_minutes)})</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{r.round_trip_time_minutes ? `${r.round_trip_time_minutes} phút` : 'Chưa đủ dữ liệu'}</td>
                  <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(r)} className="text-blue-600 hover:text-blue-800 text-sm mr-3">Sửa</button>
                    <button
                      onClick={() => setConfirm({ open: true, route: r, newStatus: r.status === 'active' ? 'inactive' : 'active' })}
                      className={`text-sm mr-3 ${r.status === 'active' ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'}`}
                    >
                      {r.status === 'active' ? 'Ngưng' : 'Kích hoạt'}
                    </button>
                    <button
                      onClick={() => setConfirm({ open: true, route: r, newStatus: 'delete' })}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-gray-400">Không tìm thấy tuyến xe nào</div>}
      </div>

      <Modal isOpen={showModal} size="max-w-4xl" title={editing ? 'Sửa tuyến xe' : 'Thêm tuyến xe'} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          {!editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã tuyến *</label>
              <input
                value={form.route_code}
                onChange={(e) => setForm({ ...form, route_code: e.target.value })}
                required
                placeholder="Ví dụ: 01, 08, 150..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên tuyến *</label>
            <input
              value={form.route_name}
              onChange={(e) => setForm({ ...form, route_name: e.target.value })}
              required
              placeholder="Ví dụ: Bến Thành - Chợ Lớn..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border border-gray-100 p-3 rounded-xl bg-gray-50 flex flex-col justify-between">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Lượt đi (Outbound)</h4>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Điểm đầu - cuối *</label>
                  <div className="flex gap-2">
                    <input value={form.outbound_start_point} onChange={e => setForm({ ...form, outbound_start_point: e.target.value, inbound_end_point: e.target.value })} placeholder="Bến A" className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none" required />
                    <input value={form.outbound_end_point} onChange={e => setForm({ ...form, outbound_end_point: e.target.value, inbound_start_point: e.target.value })} placeholder="Bến B" className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none" required />
                  </div>
                </div>
                <div className="space-y-3 mt-3">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs font-medium text-gray-700 w-1/3">Cự ly (km) *</label>
                    <input type="number" step="0.1" value={form.outbound_distance} onChange={e => setForm({ ...form, outbound_distance: e.target.value, inbound_distance: e.target.value })} required className="w-2/3 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs font-medium text-gray-700 w-1/3">TG chạy (phút) *</label>
                    <input type="number" value={form.outbound_travel_time_minutes} onChange={e => setForm({ ...form, outbound_travel_time_minutes: e.target.value })} required className="w-2/3 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="text-xs font-bold text-gray-700">Điểm dừng Lượt đi</h5>
                  <button
                    type="button"
                    onClick={() => setOutboundMiddleStops([...outboundMiddleStops, { id: Date.now() + Math.random(), stop_name: '', minute_from_start: '' }])}
                    className="text-2xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded"
                  >
                    + Thêm điểm trung gian
                  </button>
                </div>
                
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {/* First stop - locked */}
                  <div className="flex items-center gap-1.5 bg-white p-1.5 rounded border border-gray-100 text-xs">
                    <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-mono font-bold text-3xs">1</span>
                    <input
                      value={form.outbound_start_point || ''}
                      disabled
                      placeholder="Bến đầu"
                      className="flex-1 bg-gray-50 border rounded px-1.5 py-0.5 text-2xs text-gray-500 outline-none"
                    />
                    <input
                      value="0"
                      disabled
                      className="w-10 bg-gray-50 border rounded px-1.5 py-0.5 text-2xs text-gray-500 text-center outline-none"
                    />
                    <span className="text-3xs text-gray-400">phút</span>
                    <div className="w-5"></div>
                  </div>

                  {/* Middle stops */}
                  {outboundMiddleStops.map((stop, index) => (
                    <div key={stop.id} className="flex items-center gap-1.5 bg-white p-1.5 rounded border border-gray-200 text-xs">
                      <span className="w-4 h-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-mono font-bold text-3xs">{index + 2}</span>
                      <input
                        value={stop.stop_name}
                        onChange={e => {
                          const list = [...outboundMiddleStops];
                          list[index].stop_name = e.target.value;
                          setOutboundMiddleStops(list);
                        }}
                        placeholder="Tên điểm dừng"
                        required
                        className="flex-1 border rounded px-1.5 py-0.5 text-2xs focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        value={stop.minute_from_start}
                        onChange={e => {
                          const list = [...outboundMiddleStops];
                          list[index].minute_from_start = e.target.value;
                          setOutboundMiddleStops(list);
                        }}
                        placeholder="Phút"
                        required
                        className="w-12 border rounded px-1 py-0.5 text-2xs focus:ring-1 focus:ring-blue-500 text-center outline-none"
                      />
                      <span className="text-3xs text-gray-400">phút</span>
                      <button
                        type="button"
                        onClick={() => setOutboundMiddleStops(outboundMiddleStops.filter(s => s.id !== stop.id))}
                        className="text-red-500 hover:text-red-700 w-5 flex justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Last stop - locked */}
                  <div className="flex items-center gap-1.5 bg-white p-1.5 rounded border border-gray-100 text-xs">
                    <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-mono font-bold text-3xs">{outboundMiddleStops.length + 2}</span>
                    <input
                      value={form.outbound_end_point || ''}
                      disabled
                      placeholder="Bến cuối"
                      className="flex-1 bg-gray-50 border rounded px-1.5 py-0.5 text-2xs text-gray-500 outline-none"
                    />
                    <input
                      value={form.outbound_travel_time_minutes || ''}
                      disabled
                      className="w-10 bg-gray-50 border rounded px-1.5 py-0.5 text-2xs text-gray-500 text-center outline-none"
                    />
                    <span className="text-3xs text-gray-400">phút</span>
                    <div className="w-5"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-gray-100 p-3 rounded-xl bg-gray-50 flex flex-col justify-between">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Lượt về (Inbound)</h4>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Điểm đầu - cuối *</label>
                  <div className="flex gap-2">
                    <input value={form.inbound_start_point} onChange={e => setForm({ ...form, inbound_start_point: e.target.value })} placeholder="Bến B" className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none" required />
                    <input value={form.inbound_end_point} onChange={e => setForm({ ...form, inbound_end_point: e.target.value })} placeholder="Bến A" className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none" required />
                  </div>
                </div>
                <div className="space-y-3 mt-3">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs font-medium text-gray-700 w-1/3">Cự ly (km) *</label>
                    <input type="number" step="0.1" value={form.inbound_distance} onChange={e => setForm({ ...form, inbound_distance: e.target.value })} required className="w-2/3 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs font-medium text-gray-700 w-1/3">TG chạy (phút) *</label>
                    <input type="number" value={form.inbound_travel_time_minutes} onChange={e => setForm({ ...form, inbound_travel_time_minutes: e.target.value })} required className="w-2/3 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="text-xs font-bold text-gray-700">Điểm dừng Lượt về</h5>
                  <button
                    type="button"
                    onClick={() => setInboundMiddleStops([...inboundMiddleStops, { id: Date.now() + Math.random(), stop_name: '', minute_from_start: '' }])}
                    className="text-2xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded"
                  >
                    + Thêm điểm trung gian
                  </button>
                </div>
                
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {/* First stop - locked */}
                  <div className="flex items-center gap-1.5 bg-white p-1.5 rounded border border-gray-100 text-xs">
                    <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-mono font-bold text-3xs">1</span>
                    <input
                      value={form.inbound_start_point || ''}
                      disabled
                      placeholder="Bến đầu"
                      className="flex-1 bg-gray-50 border rounded px-1.5 py-0.5 text-2xs text-gray-500 outline-none"
                    />
                    <input
                      value="0"
                      disabled
                      className="w-10 bg-gray-50 border rounded px-1.5 py-0.5 text-2xs text-gray-500 text-center outline-none"
                    />
                    <span className="text-3xs text-gray-400">phút</span>
                    <div className="w-5"></div>
                  </div>

                  {/* Middle stops */}
                  {inboundMiddleStops.map((stop, index) => (
                    <div key={stop.id} className="flex items-center gap-1.5 bg-white p-1.5 rounded border border-gray-200 text-xs">
                      <span className="w-4 h-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-mono font-bold text-3xs">{index + 2}</span>
                      <input
                        value={stop.stop_name}
                        onChange={e => {
                          const list = [...inboundMiddleStops];
                          list[index].stop_name = e.target.value;
                          setInboundMiddleStops(list);
                        }}
                        placeholder="Tên điểm dừng"
                        required
                        className="flex-1 border rounded px-1.5 py-0.5 text-2xs focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        value={stop.minute_from_start}
                        onChange={e => {
                          const list = [...inboundMiddleStops];
                          list[index].minute_from_start = e.target.value;
                          setInboundMiddleStops(list);
                        }}
                        placeholder="Phút"
                        required
                        className="w-12 border rounded px-1 py-0.5 text-2xs focus:ring-1 focus:ring-blue-500 text-center outline-none"
                      />
                      <span className="text-3xs text-gray-400">phút</span>
                      <button
                        type="button"
                        onClick={() => setInboundMiddleStops(inboundMiddleStops.filter(s => s.id !== stop.id))}
                        className="text-red-500 hover:text-red-700 w-5 flex justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Last stop - locked */}
                  <div className="flex items-center gap-1.5 bg-white p-1.5 rounded border border-gray-100 text-xs">
                    <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-mono font-bold text-3xs">{inboundMiddleStops.length + 2}</span>
                    <input
                      value={form.inbound_end_point || ''}
                      disabled
                      placeholder="Bến cuối"
                      className="flex-1 bg-gray-50 border rounded px-1.5 py-0.5 text-2xs text-gray-500 outline-none"
                    />
                    <input
                      value={form.inbound_travel_time_minutes || ''}
                      disabled
                      className="w-10 bg-gray-50 border rounded px-1.5 py-0.5 text-2xs text-gray-500 text-center outline-none"
                    />
                    <span className="text-3xs text-gray-400">phút</span>
                    <div className="w-5"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Xuất phát Bến A (Outbound) *</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Xuất phát Bến B (Inbound) *</label>
              <input
                type="time"
                value={form.inbound_start_time}
                onChange={(e) => setForm({ ...form, inbound_start_time: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giờ kết thúc hoạt động *</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-gray-700 w-1/3">Thời gian giãn cách chuyến *</label>
              <div className="w-2/3 flex items-center gap-2">
                <input
                  type="number"
                  value={form.headway_minutes}
                  onChange={(e) => setForm({ ...form, headway_minutes: e.target.value })}
                  required
                  min="1"
                  step="1"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">phút</span>
              </div>
            </div>
            {form.start_time && form.end_time && form.headway_minutes > 0 && (
              <div className="flex justify-end mt-1">
                <div className="w-2/3 text-xs text-blue-600 font-medium">
                  Hệ thống tự tính: Khoảng {Math.floor((timeToMinutes(form.end_time) - timeToMinutes(form.start_time)) / Number(form.headway_minutes)) + 1} lượt mỗi chiều mỗi ngày.
                </div>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-gray-700 w-1/3">Tổng xe dự kiến huy động</label>
              <div className="w-2/3 flex items-center justify-between border border-gray-100 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700 font-medium">
                <span>{editingSuggestedBuses} xe</span>
                <span className="text-xs text-amber-600 font-normal">({editingBaseBuses} xe nền + {editingRecoveryBuses} xe trám)</span>
              </div>
            </div>
            <div className="flex justify-end mt-1">
              <div className="w-2/3 text-xs text-gray-500 italic">
                Hệ thống tự động tính toán số xe cần thiết dựa trên thời gian vòng xe và giãn cách chuyến.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-gray-700 w-1/3">Trạng thái *</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              required
              className="w-2/3 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngưng hoạt động</option>
            </select>
          </div>

          {/* Scheduling Parameters */}
          <div className="grid grid-cols-2 gap-4 mt-6 border-t pt-4">
            <h4 className="col-span-2 text-sm font-semibold text-gray-700">Tham số lập lịch nâng cao</h4>
            

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nghỉ ngắn tại bến (phút)</label>
              <input type="number" value={form.short_layover_minutes} onChange={e => setForm({...form, short_layover_minutes: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nghỉ dài / Đổi ca (phút)</label>
              <input type="number" value={form.long_layover_minutes} onChange={e => setForm({...form, long_layover_minutes: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giới hạn lái liên tục (phút)</label>
              <input type="number" value={form.max_driving_minutes} onChange={e => setForm({...form, max_driving_minutes: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tỉ lệ dự bị Tài xế (Ví dụ: 0.15)</label>
              <input type="number" step="0.01" value={form.standby_ratio} onChange={e => setForm({...form, standby_ratio: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tỉ lệ Xe dự phòng (Ví dụ: 0.20)</label>
              <input type="number" step="0.01" value={form.backup_bus_ratio} onChange={e => setForm({...form, backup_bus_ratio: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TG bảo dưỡng tại bến (phút)</label>
              <input type="number" value={form.min_rest_time_minutes} onChange={e => setForm({...form, min_rest_time_minutes: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-blue-800">Nhu cầu Tài xế (Tính tự động)</h4>
              <p className="text-sm text-blue-600 mt-1">
                Số ca (Main): <span className="font-bold">{mainShifts}</span> | 
                Dự bị (Standby): <span className="font-bold">{standbyCount}</span>
              </p>
            </div>
            <div className="flex gap-4 text-center">
              <div className="bg-white px-4 py-2 rounded shadow-sm border border-blue-200">
                <div className="text-xs text-gray-500">Cần cho 1 Ngày</div>
                <div className="text-xl font-bold text-blue-700">{dailyDrivers}</div>
              </div>
              <div className="bg-white px-4 py-2 rounded shadow-sm border border-blue-200">
                <div className="text-xs text-gray-500">Cần cho 1 Tuần</div>
                <div className="text-xl font-bold text-blue-700">{weeklyDrivers}</div>
              </div>
            </div>
          </div>

          <div className="mt-2 p-4 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-emerald-800">Nhu cầu Xe Buýt (Tính tự động)</h4>
              <p className="text-sm text-emerald-600 mt-1">
                Xe ca chạy: <span className="font-bold">{editingSuggestedBuses}</span> | 
                Xe dự phòng: <span className="font-bold">{editingBackupBuses}</span>
              </p>
            </div>
            <div className="flex gap-4 text-center">
              <div className="bg-white px-4 py-2 rounded shadow-sm border border-emerald-200">
                <div className="text-xs text-gray-500">Tổng Xe Cần Phân Bổ</div>
                <div className="text-xl font-bold text-emerald-700">{editingTotalBuses}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">Hủy</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">Lưu</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirm.open}
        title={confirm.newStatus === 'delete' ? 'Xóa tuyến xe vĩnh viễn?' : confirm.newStatus === 'inactive' ? 'Ngưng hoạt động tuyến?' : 'Kích hoạt tuyến?'}
        message={confirm.newStatus === 'delete' ? `Hành động này sẽ XÓA VĨNH VIỄN tuyến "${confirm.route?.route_name}" cùng với tất cả chuyến xe, kế hoạch, trạm dừng và phân công liên quan. Bạn có chắc chắn không?` : `Bạn có chắc muốn ${confirm.newStatus === 'inactive' ? 'ngưng hoạt động' : 'kích hoạt'} tuyến "${confirm.route?.route_name}" không?`}
        onConfirm={handleStatusChange}
        onCancel={() => setConfirm({ open: false, route: null, newStatus: '' })}
        danger={confirm.newStatus === 'inactive' || confirm.newStatus === 'delete'}
      />
    </Layout>
  );
}
