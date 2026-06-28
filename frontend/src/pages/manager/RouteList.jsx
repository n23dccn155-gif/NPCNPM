import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, ConfirmDialog, Modal, AlertBox } from '../../components/UI';
import { getRoutes, createRoute, updateRoute, updateRouteStatus, deleteRoute } from '../../services/routeService';

const emptyForm = {
  route_code: '',
  route_name: '',
  start_time: '05:00',
  end_time: '21:00',
  expected_trips_per_day: 50,
  headway_minutes: 18,
  confirmed_operating_buses: 1,
  status: 'active',
  outbound_start_point: '',
  outbound_end_point: '',
  outbound_distance: '',
  inbound_start_point: '',
  inbound_end_point: '',
  inbound_distance: '',
  outbound_travel: 30,
  inbound_travel: 30,
  short_layover_minutes: 10,
  max_driving_minutes: 3, // Defaults to 3 rounds before long rest
  standby_ratio: 0.15,
  backup_bus_ratio: 0.20,
  min_rest_time_minutes: 30,
  confirmed_operating_drivers: ''
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

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (r) => {
    console.log('Editing route object:', r);
    setEditing(r);
    setForm({
      route_code: r.route_code,
      route_name: r.route_name || '',
      start_time: toTimeInput(r.start_time, '05:00'),
      end_time: toTimeInput(r.end_time, '21:00'),
      expected_trips_per_day: r.expected_trips_per_day ?? 50,
      headway_minutes: r.headway_minutes ?? r.calculated_headway_minutes ?? 18,
      confirmed_operating_buses: r.confirmed_operating_buses ?? 1,
      status: r.status || 'active',
      outbound_start_point: r.outbound_start_point || '',
      outbound_end_point: r.outbound_end_point || '',
      outbound_distance: r.outbound_distance_km || '',
      inbound_start_point: r.inbound_start_point || '',
      inbound_end_point: r.inbound_end_point || '',
      inbound_distance: r.inbound_distance_km ?? '',
      outbound_travel: r.outbound_travel_time_minutes ?? r.travel_time_minutes ?? 30,
      inbound_travel: r.inbound_travel_time_minutes ?? r.travel_time_minutes ?? 30,
      short_layover_minutes: r.short_layover_minutes ?? 10,
      max_driving_minutes: r.max_driving_minutes ?? 3,
      standby_ratio: r.standby_ratio ?? 0.15,
      backup_bus_ratio: r.backup_bus_ratio ?? 0.20,
      min_rest_time_minutes: r.min_rest_time_minutes ?? 30,
      confirmed_operating_drivers: ''
    });
    setFormError('');
    setShowModal(true);
  };

  const buildPayload = () => {
    const startMin = timeToMinutes(form.start_time);
    const endMin = timeToMinutes(form.end_time);
    const expectedTrips = Number(form.expected_trips_per_day);
    const roundTripTravelTime = (Number(form.outbound_travel) || 30) + (Number(form.inbound_travel) || 30);
    const operatingTimeFund = (endMin - startMin) - roundTripTravelTime;
    let finalHeadway = Number(form.headway_minutes) || 30;
    if (expectedTrips > 1 && operatingTimeFund > 0) {
      finalHeadway = Math.round(operatingTimeFund / (expectedTrips - 1));
    }

    const maxCycle = roundTripTravelTime + (Number(form.min_rest_time_minutes) || 30);
    const suggestedBuses = (finalHeadway > 0 && maxCycle > 0) ? Math.ceil(maxCycle / finalHeadway) : 0;
    const backupBuses = Math.ceil(suggestedBuses * (Number(form.backup_bus_ratio) || 0));
    const totalBuses = suggestedBuses + backupBuses;

    return {
      route_name: form.route_name.trim(),
      start_time: form.start_time,
      end_time: form.end_time,
      expected_trips_per_day: expectedTrips,
      headway_minutes: finalHeadway,
      confirmed_operating_buses: suggestedBuses,
      outbound_start_point: form.outbound_start_point.trim(),
      outbound_end_point: form.outbound_end_point.trim(),
      outbound_distance: form.outbound_distance ? Number(form.outbound_distance) : null,
      inbound_start_point: form.inbound_start_point.trim(),
      inbound_end_point: form.inbound_end_point.trim(),
      inbound_distance: form.inbound_distance ? Number(form.inbound_distance) : null,
      outbound_travel: Number(form.outbound_travel),
      outbound_turnaround: 0,
      inbound_travel: Number(form.inbound_travel),
      inbound_turnaround: 0,
      short_layover_minutes: Number(form.short_layover_minutes),
      long_layover_minutes: Number(form.min_rest_time_minutes),
      max_driving_minutes: Number(form.max_driving_minutes),
      standby_ratio: Number(form.standby_ratio),
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
  const parseTime = (tStr) => {
    if (!tStr) return 0;
    const [h, m] = tStr.split(':').map(Number);
    return h * 60 + m;
  };
  const startMin = parseTime(form.start_time);
  const endMin = parseTime(form.end_time);
  const outTravel = Number(form.outbound_travel) || 30;
  const inTravel = Number(form.inbound_travel) || 30;
  const roundTripTravelTime = outTravel + inTravel;
  const expectedTrips = Number(form.expected_trips_per_day) || 50;

  const operatingTimeFund = (endMin - startMin) - roundTripTravelTime;

  let calculatedHeadway = Number(form.headway_minutes) || 30;
  if (expectedTrips > 1 && operatingTimeFund > 0) {
    calculatedHeadway = Math.round(operatingTimeFund / (expectedTrips - 1));
  }

  const longLayoverMinutes = Number(form.min_rest_time_minutes) || 30;
  const maxCycle = roundTripTravelTime + longLayoverMinutes;

  const editingSuggestedBuses = (calculatedHeadway > 0 && maxCycle > 0) ? Math.ceil(maxCycle / calculatedHeadway) : 0;
  const editingBackupBuses = Math.ceil(editingSuggestedBuses * (Number(form.backup_bus_ratio) || 0));
  const editingTotalBuses = editingSuggestedBuses + editingBackupBuses;

  const dailyDrivers = Math.ceil((editingSuggestedBuses * 7) / 6);
  const mainShifts = editingSuggestedBuses;
  const standbyCount = dailyDrivers - mainShifts;
  const weeklyDrivers = dailyDrivers;

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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Mã tuyến</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tên tuyến</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Giờ hoạt động</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Lượt/chiều</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Giãn cách</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vòng xe</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Xe vận doanh</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Xe dự phòng</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.route_code} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 font-mono font-medium text-slate-900 tabular-nums">{r.route_code}</td>
                  <td className="px-6 py-4 text-slate-700 text-sm">{r.route_name}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm tabular-nums">{toTimeInput(r.start_time, '--:--')} - {toTimeInput(r.end_time, '--:--')}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm tabular-nums">{r.expected_trips_per_day}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm tabular-nums">
                    {formatMinutes(r.headway_minutes)}
                    {r.calculated_headway_minutes && Math.abs(r.calculated_headway_minutes - r.headway_minutes) > 0.01 && (
                      <span className="text-xs text-slate-400 block mt-0.5">(Tối đa: {formatMinutes(r.calculated_headway_minutes)})</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm tabular-nums">{r.round_trip_time_minutes ? `${r.round_trip_time_minutes} phút` : '---'}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm tabular-nums">
                    <div className="font-semibold">{r.operating_buses_count} / {r.confirmed_operating_buses} xe</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Thực tế / Yêu cầu</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm tabular-nums">
                    <div className="font-semibold">{r.standby_buses_count} / {r.required_backup_buses} xe</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Thực tế / Yêu cầu</div>
                  </td>
                  <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(r)} className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3 transition">Sửa</button>
                    <button
                      onClick={() => setConfirm({ open: true, route: r, newStatus: r.status === 'active' ? 'inactive' : 'active' })}
                      className={`text-sm font-medium mr-3 transition ${r.status === 'active' ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'}`}
                    >
                      {r.status === 'active' ? 'Ngưng' : 'Kích hoạt'}
                    </button>
                    <button
                      onClick={() => setConfirm({ open: true, route: r, newStatus: 'delete' })}
                      className="text-red-600 hover:text-red-800 text-sm font-medium transition"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400">Không tìm thấy tuyến xe nào</div>}
      </div>

      <Modal isOpen={showModal} title={editing ? 'Sửa tuyến xe' : 'Thêm tuyến xe'} onClose={() => setShowModal(false)}>
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
            <div className="border border-gray-100 p-3 rounded-xl bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Lượt đi </h4>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Điểm đầu - cuối *</label>
                  <div className="flex gap-2">
                    <input value={form.outbound_start_point} onChange={e => setForm({ ...form, outbound_start_point: e.target.value, inbound_end_point: e.target.value })} placeholder="Bến A" className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none" required />
                    <input value={form.outbound_end_point} onChange={e => setForm({ ...form, outbound_end_point: e.target.value, inbound_start_point: e.target.value })} placeholder="Bến B" className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none" required />
                  </div>
                </div>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs font-medium text-gray-700 w-1/3">Cự ly (km) *</label>
                    <input type="number" onWheel={(e) => e.target.blur()} step="0.1" value={form.outbound_distance} onChange={e => setForm({ ...form, outbound_distance: e.target.value, inbound_distance: e.target.value })} required className="w-2/3 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs font-medium text-gray-700 w-1/3">TG chạy (phút) *</label>
                    <input type="number" onWheel={(e) => e.target.blur()} value={form.outbound_travel} onChange={e => setForm({ ...form, outbound_travel: e.target.value, inbound_travel: e.target.value })} required className="w-2/3 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
            </div>
            <div className="border border-gray-100 p-3 rounded-xl bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Lượt về </h4>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Điểm đầu - cuối *</label>
                  <div className="flex gap-2">
                    <input value={form.inbound_start_point} onChange={e => setForm({ ...form, inbound_start_point: e.target.value })} placeholder="Bến B" className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none" required />
                    <input value={form.inbound_end_point} onChange={e => setForm({ ...form, inbound_end_point: e.target.value })} placeholder="Bến A" className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none" required />
                  </div>
                </div>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs font-medium text-gray-700 w-1/3">Cự ly (km) *</label>
                    <input type="number" onWheel={(e) => e.target.blur()} step="0.1" value={form.inbound_distance} onChange={e => setForm({ ...form, inbound_distance: e.target.value })} required className="w-2/3 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs font-medium text-gray-700 w-1/3">TG chạy (phút) *</label>
                    <input type="number" onWheel={(e) => e.target.blur()} value={form.inbound_travel} onChange={e => setForm({ ...form, inbound_travel: e.target.value })} required className="w-2/3 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giờ bắt đầu*</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giờ kết thúc*</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4 border-t pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tổng chuyến (mỗi chiều) *</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  onWheel={(e) => e.target.blur()}
                  value={form.expected_trips_per_day}
                  onChange={(e) => setForm({ ...form, expected_trips_per_day: e.target.value })}
                  required
                  min="1"
                  step="1"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500 w-16">chuyến</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian giãn cách tự động *</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={calculatedHeadway}
                  readOnly
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-500 font-bold focus:outline-none cursor-not-allowed"
                />
                <span className="text-sm text-gray-500 w-16">phút</span>
              </div>
            </div>
          </div>

          {/* Scheduling Parameters */}
          <div className="grid grid-cols-2 gap-4 mt-4 border-t pt-4">

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nghỉ ngắn sau mỗi vòng (phút) *</label>
              <input type="number" onWheel={(e) => e.target.blur()} value={form.short_layover_minutes} onChange={e => setForm({ ...form, short_layover_minutes: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Số vòng chạy nghỉ dài (Vòng) *</label>
              <input type="number" onWheel={(e) => e.target.blur()} value={form.max_driving_minutes} onChange={e => setForm({ ...form, max_driving_minutes: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nghỉ dài & Bảo dưỡng tại bến (phút) *</label>
              <input type="number" onWheel={(e) => e.target.blur()} value={form.min_rest_time_minutes} onChange={e => setForm({ ...form, min_rest_time_minutes: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tỉ lệ dự bị Tài xế *</label>
              <input type="number" onWheel={(e) => e.target.blur()} step="0.01" value={form.standby_ratio} onChange={e => setForm({ ...form, standby_ratio: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tỉ lệ Xe dự phòng *</label>
              <input type="number" onWheel={(e) => e.target.blur()} step="0.01" value={form.backup_bus_ratio} onChange={e => setForm({ ...form, backup_bus_ratio: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
          </div>

          {/* Auto suggestions */}
          <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-blue-800 text-xs">Nhu cầu Tài xế</h4>
              <p className="text-[11px] text-blue-600 mt-0.5">
                Chạy chính: <span className="font-bold">{mainShifts}</span> | Dự phòng: <span className="font-bold">{standbyCount}</span>
              </p>
            </div>
            <div className="flex gap-2 text-center">
              <div className="bg-white px-2.5 py-1 rounded shadow-sm border border-blue-200 text-2xs">
                <div className="text-[10px] text-gray-500">Tổng tài xế ấn định</div>
                <div className="text-sm font-bold text-blue-700">{dailyDrivers}</div>
              </div>
            </div>
          </div>

          <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-emerald-800 text-xs">Nhu cầu Xe Buýt</h4>
              <p className="text-[11px] text-emerald-600 mt-0.5">
                Xe ca chạy: <span className="font-bold">{editingSuggestedBuses}</span> | Xe dự phòng: <span className="font-bold">{editingBackupBuses}</span>
              </p>
            </div>
            <div className="flex gap-2 text-center">
              <div className="bg-white px-2.5 py-1 rounded shadow-sm border border-emerald-200 text-2xs">
                <div className="text-[10px] text-gray-500">Tổng Xe Cần Phân Bổ</div>
                <div className="text-sm font-bold text-emerald-700">{editingTotalBuses}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-gray-700 w-1/3">Trạng thái tuyến *</label>
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

