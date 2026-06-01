import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, ConfirmDialog, Modal, AlertBox } from '../../components/UI';
import { getRoutes, createRoute, updateRoute, updateRouteStatus } from '../../services/routeService';

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
  outbound_travel: 45,
  outbound_turnaround: 15,
  inbound_start_point: '',
  inbound_end_point: '',
  inbound_distance: '',
  inbound_travel: 45,
  inbound_turnaround: 15
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
      expected_trips_per_day: r.expected_trips_per_day ?? 20,
      headway_minutes: r.headway_minutes ?? r.calculated_headway_minutes ?? 50,
      confirmed_operating_buses: r.confirmed_operating_buses ?? 1,
      status: r.status || 'active',
      outbound_start_point: r.outbound_start_point || '',
      outbound_end_point: r.outbound_end_point || '',
      outbound_distance: r.outbound_distance_km || '',
      outbound_travel: r.outbound_travel_time_minutes ?? 45,
      outbound_turnaround: r.outbound_turnaround_time_minutes ?? 15,
      inbound_start_point: r.inbound_start_point || '',
      inbound_end_point: r.inbound_end_point || '',
      inbound_distance: r.inbound_distance_km || '',
      inbound_travel: r.inbound_travel_time_minutes ?? 45,
      inbound_turnaround: r.inbound_turnaround_time_minutes ?? 15
    });
    setFormError('');
    setShowModal(true);
  };

  const buildPayload = () => ({
    route_name: form.route_name.trim(),
    start_time: form.start_time,
    end_time: form.end_time,
    expected_trips_per_day: Number(form.expected_trips_per_day),
    headway_minutes: Number(form.headway_minutes),
    confirmed_operating_buses: Number(form.confirmed_operating_buses),
    outbound_start_point: form.outbound_start_point.trim(),
    outbound_end_point: form.outbound_end_point.trim(),
    outbound_distance: form.outbound_distance ? Number(form.outbound_distance) : null,
    outbound_travel: Number(form.outbound_travel),
    outbound_turnaround: Number(form.outbound_turnaround),
    inbound_start_point: form.inbound_start_point.trim(),
    inbound_end_point: form.inbound_end_point.trim(),
    inbound_distance: form.inbound_distance ? Number(form.inbound_distance) : null,
    inbound_travel: Number(form.inbound_travel),
    inbound_turnaround: Number(form.inbound_turnaround)
  });

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    const calculatedHeadway = calculateHeadway(form.start_time, form.end_time, form.expected_trips_per_day);
    if (calculatedHeadway === null) {
      setFormError('Giờ hoạt động hoặc số lượt xuất bến dự kiến mỗi chiều không hợp lệ');
      return;
    }
    if (Number(form.headway_minutes) > calculatedHeadway) {
      setFormError(`Giãn cách khai thác không được lớn hơn ${Number(calculatedHeadway.toFixed(2))} phút`);
      return;
    }
    if (editingSuggestedBuses && Number(form.confirmed_operating_buses) < editingSuggestedBuses) {
      setFormError(`Số xe vận doanh xác nhận phải từ ${editingSuggestedBuses} xe trở lên theo thời gian vòng xe hiện tại`);
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
      await updateRouteStatus(confirm.route.route_code, confirm.newStatus);
      setConfirm({ open: false, route: null, newStatus: '' });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái');
    }
  };

  if (loading) return <Layout><div className="flex justify-center py-12 text-gray-500">Đang tải...</div></Layout>;

  const filtered = routes.filter(r => {
    const matchSearch = !search || r.route_code.toLowerCase().includes(search.toLowerCase()) || r.route_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || r.status === filterStatus;
    return matchSearch && matchStatus;
  });
  const calculatedFormHeadway = calculateHeadway(form.start_time, form.end_time, form.expected_trips_per_day);
  const rtt = Number(form.outbound_travel) + Number(form.outbound_turnaround) + Number(form.inbound_travel) + Number(form.inbound_turnaround);
  const editingSuggestedBuses = (Number(form.headway_minutes) > 0 && rtt > 0) ? Math.ceil(rtt / Number(form.headway_minutes)) : null;

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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lượt/chiều</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giãn cách tối đa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giãn cách chốt</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vòng xe</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Xe gợi ý</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Xe xác nhận</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Xe dự phòng</th>
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
                  <td className="px-6 py-4 text-gray-600 text-sm">{r.expected_trips_per_day}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{formatMinutes(r.calculated_headway_minutes)}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{formatMinutes(r.headway_minutes)}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{r.round_trip_time_minutes ? `${r.round_trip_time_minutes} phút` : 'Chưa đủ dữ liệu'}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{r.suggested_operating_buses || 'Chưa đủ dữ liệu'}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{r.confirmed_operating_buses}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{r.standby_buses_count ?? 0}</td>
                  <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(r)} className="text-blue-600 hover:text-blue-800 text-sm mr-3">Sửa</button>
                    <button
                      onClick={() => setConfirm({ open: true, route: r, newStatus: r.status === 'active' ? 'inactive' : 'active' })}
                      className={`text-sm ${r.status === 'active' ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}
                    >
                      {r.status === 'active' ? 'Ngưng' : 'Kích hoạt'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-gray-400">Không tìm thấy tuyến xe nào</div>}
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
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Lượt đi (Outbound)</h4>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Điểm đầu - cuối</label>
                  <div className="flex gap-2">
                    <input 
                      value={form.outbound_start_point} 
                      onChange={e => setForm({...form, outbound_start_point: e.target.value, inbound_end_point: e.target.value})} 
                      placeholder="Bến A" 
                      className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none" 
                    />
                    <input 
                      value={form.outbound_end_point} 
                      onChange={e => setForm({...form, outbound_end_point: e.target.value, inbound_start_point: e.target.value})} 
                      placeholder="Bến B" 
                      className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1" title="Cự ly (km)">Cự ly (km)</label>
                    <input type="number" step="0.1" value={form.outbound_distance} onChange={e => setForm({...form, outbound_distance: e.target.value, inbound_distance: e.target.value})} className="w-full border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1" title="Thời gian chạy">TG chạy (p)</label>
                    <input type="number" min="1" value={form.outbound_travel} onChange={e => setForm({...form, outbound_travel: e.target.value})} className="w-full border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1" title="Nghỉ quay đầu">Nghỉ (p)</label>
                    <input type="number" min="0" value={form.outbound_turnaround} onChange={e => setForm({...form, outbound_turnaround: e.target.value})} className="w-full border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </div>
            </div>
            <div className="border border-gray-100 p-3 rounded-xl bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Lượt về (Inbound)</h4>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Điểm đầu - cuối</label>
                  <div className="flex gap-2">
                    <input value={form.inbound_start_point} onChange={e => setForm({...form, inbound_start_point: e.target.value})} placeholder="Bến B" className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                    <input value={form.inbound_end_point} onChange={e => setForm({...form, inbound_end_point: e.target.value})} placeholder="Bến A" className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1" title="Cự ly (km)">Cự ly (km)</label>
                    <input type="number" step="0.1" value={form.inbound_distance} onChange={e => setForm({...form, inbound_distance: e.target.value})} className="w-full border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1" title="Thời gian chạy">TG chạy (p)</label>
                    <input type="number" min="1" value={form.inbound_travel} onChange={e => setForm({...form, inbound_travel: e.target.value})} className="w-full border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1" title="Nghỉ quay đầu">Nghỉ (p)</label>
                    <input type="number" min="0" value={form.inbound_turnaround} onChange={e => setForm({...form, inbound_turnaround: e.target.value})} className="w-full border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giờ bắt đầu hoạt động *</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số lượt xuất bến dự kiến mỗi chiều *</label>
              <input
                type="number"
                value={form.expected_trips_per_day}
                onChange={(e) => setForm({ ...form, expected_trips_per_day: e.target.value })}
                required
                min="2"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giãn cách khai thác đã chốt *</label>
              <input
                type="number"
                value={form.headway_minutes}
                onChange={(e) => setForm({ ...form, headway_minutes: e.target.value })}
                onFocus={() => {
                  if (calculatedFormHeadway) {
                    setForm({ ...form, headway_minutes: Number(calculatedFormHeadway.toFixed(2)) });
                  }
                }}
                required
                min="1"
                max={calculatedFormHeadway ? Number(calculatedFormHeadway.toFixed(2)) : undefined}
                step="0.01"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-amber-600 font-medium mt-1">
                Tối đa: {formatMinutes(calculatedFormHeadway)}. Có thể giảm để tăng mật độ chuyến.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số xe vận doanh xác nhận *</label>
              <input
                type="number"
                value={form.confirmed_operating_buses}
                onChange={(e) => setForm({ ...form, confirmed_operating_buses: e.target.value })}
                required
                min={editingSuggestedBuses || 1}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {editingSuggestedBuses && (
                <p className="text-xs text-amber-600 font-medium mt-1">Tối thiểu gợi ý: {editingSuggestedBuses} xe</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái *</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngưng hoạt động</option>
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">Hủy</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">Lưu</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirm.open}
        title={confirm.newStatus === 'inactive' ? 'Ngưng hoạt động tuyến?' : 'Kích hoạt tuyến?'}
        message={`Bạn có chắc muốn ${confirm.newStatus === 'inactive' ? 'ngưng hoạt động' : 'kích hoạt'} tuyến "${confirm.route?.route_name}" không?`}
        onConfirm={handleStatusChange}
        onCancel={() => setConfirm({ open: false, route: null, newStatus: '' })}
        danger={confirm.newStatus === 'inactive'}
      />
    </Layout>
  );
}
