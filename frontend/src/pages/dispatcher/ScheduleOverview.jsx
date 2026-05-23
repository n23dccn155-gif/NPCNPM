import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, AlertBox, Modal } from '../../components/UI';
import { getSchedule } from '../../services/tripService';
import { getTrips, createTrip } from '../../services/tripService';
import { checkAssignment, createAssignment, replaceAssignment } from '../../services/tripService';
import { getBuses } from '../../services/busService';
import { getDrivers } from '../../services/driverService';
import { getRoutes } from '../../services/routeService';

export default function ScheduleOverview() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [tripForm, setTripForm] = useState({ trip_code: '', route_code: '', trip_date: '', direction: 'outbound', scheduled_departure: '', scheduled_arrival: '' });
  const [assignForm, setAssignForm] = useState({ bus_id: '', driver_code: '' });
  const [checkResult, setCheckResult] = useState(null);
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoading(true);
    const [sched, busRes, driverRes, routeRes] = await Promise.all([
      getSchedule({ trip_date: filterDate }),
      getBuses({ status: 'active' }),
      getDrivers({ status: 'working' }),
      getRoutes({ status: 'active' }),
    ]);
    setSchedule(sched.data?.data || []);
    setBuses(busRes.data?.data || []);
    setDrivers(driverRes.data?.data || []);
    setRoutes(routeRes.data?.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterDate]);

  const handleCheck = async () => {
    if (!assignForm.bus_id || !assignForm.driver_code) return;
    try {
      const res = await checkAssignment({ trip_code: selectedTrip.trip_code, bus_id: assignForm.bus_id, driver_code: assignForm.driver_code });
      setCheckResult(res.data.data);
    } catch (err) { setFormError(err.response?.data?.message || 'Lỗi kiểm tra'); }
  };

  const handleAssign = async () => {
    setFormError('');
    try {
      const hasActive = selectedTrip.assignment_status === 'active';
      if (hasActive) await replaceAssignment(selectedTrip.trip_code, assignForm);
      else await createAssignment({ trip_code: selectedTrip.trip_code, ...assignForm });
      setShowAssignModal(false); setCheckResult(null); load();
    } catch (err) {
      const issues = err.response?.data?.issues;
      setFormError(issues ? issues.join('\n') : (err.response?.data?.message || 'Lỗi phân công'));
    }
  };

  const handleCreateTrip = async (e) => {
    e.preventDefault(); setFormError('');
    try {
      await createTrip(tripForm);
      setShowTripModal(false); load();
    } catch (err) { setFormError(err.response?.data?.message || 'Lỗi lập chuyến'); }
  };

  const openAssign = (trip) => { setSelectedTrip(trip); setAssignForm({ bus_id: trip.bus_id || '', driver_code: trip.driver_code || '' }); setCheckResult(null); setFormError(''); setShowAssignModal(true); };

  return (
    <Layout>
      <PageHeader title="Lịch phân công" subtitle="Quản lý chuyến xe và phân công tài xế/xe buýt"
        action={
          <div className="flex gap-2 items-center">
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={() => { setTripForm({ trip_code: '', route_code: '', trip_date: filterDate, direction: 'outbound', scheduled_departure: '', scheduled_arrival: '' }); setFormError(''); setShowTripModal(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Lập chuyến</button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12 text-gray-500">Đang tải...</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Mã chuyến', 'Tuyến', 'Chiều', 'Giờ chạy', 'Xe', 'Tài xế', 'Trạng thái', 'Thao tác'].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase ${h === 'Thao tác' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {schedule.map((s) => (
                <tr key={s.trip_code} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{s.trip_code}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.route_code} - {s.route_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.direction === 'outbound' ? 'bg-indigo-50 text-indigo-600' : 'bg-pink-50 text-pink-600'}`}>
                      {s.direction === 'outbound' ? '→ Đi' : '← Về'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                    {s.scheduled_departure?.substring(0,5)} – {s.scheduled_arrival?.substring(0,5) || '?'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.bus_id || <span className="text-gray-400 italic">Chưa chọn</span>}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.driver_name || <span className="text-gray-400 italic">—</span>}</td>
                  <td className="px-4 py-3">
                    {s.assignment_status
                      ? <StatusBadge status={s.assignment_status} />
                      : <span className="text-xs text-orange-500 font-medium">Chưa phân công</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openAssign(s)} className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs px-3 py-1.5 rounded-lg font-medium transition">
                      {s.assignment_status === 'active' ? 'Điều chỉnh' : 'Phân công'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {schedule.length === 0 && <div className="text-center py-16 text-gray-400">Không có chuyến nào trong ngày {filterDate}</div>}
        </div>
      )}

      {/* Modal lập chuyến */}
      <Modal isOpen={showTripModal} title="Lập chuyến xe mới" onClose={() => setShowTripModal(false)}>
        <form onSubmit={handleCreateTrip} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã chuyến *</label>
              <input value={tripForm.trip_code} onChange={(e) => setTripForm({ ...tripForm, trip_code: e.target.value })} required placeholder="VD: CX001"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tuyến xe *</label>
              <select value={tripForm.route_code} onChange={(e) => setTripForm({ ...tripForm, route_code: e.target.value })} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Chọn tuyến —</option>
                {routes.map(r => <option key={r.route_code} value={r.route_code}>{r.route_code} - {r.route_name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày chạy *</label>
              <input type="date" value={tripForm.trip_date} onChange={(e) => setTripForm({ ...tripForm, trip_date: e.target.value })} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hướng chạy *</label>
              <select value={tripForm.direction} onChange={(e) => setTripForm({ ...tripForm, direction: e.target.value })} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="outbound">Chiều đi (Outbound)</option>
                <option value="inbound">Chiều về (Inbound)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giờ xuất bến *</label>
              <input type="time" value={tripForm.scheduled_departure} onChange={(e) => setTripForm({ ...tripForm, scheduled_departure: e.target.value })} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giờ kết thúc dự kiến *</label>
              <input type="time" value={tripForm.scheduled_arrival} onChange={(e) => setTripForm({ ...tripForm, scheduled_arrival: e.target.value })} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowTripModal(false)} className="px-4 py-2 border rounded-xl text-sm text-gray-600">Hủy</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">Lập chuyến</button>
          </div>
        </form>
      </Modal>

      {/* Modal phân công */}
      <Modal isOpen={showAssignModal} title={`Phân công: ${selectedTrip?.trip_code}`} onClose={() => setShowAssignModal(false)}>
        <div className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              {formError.split('\n').map((line, i) => <div key={i} className="text-red-700 text-sm">⚠️ {line}</div>)}
            </div>
          )}
          {checkResult && (
            <div className={`rounded-xl p-3 border ${checkResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {checkResult.valid
                ? <p className="text-green-700 text-sm font-medium">✅ Phân công hợp lệ, có thể xác nhận</p>
                : checkResult.issues.map((issue, i) => <p key={i} className="text-red-700 text-sm">⚠️ {issue}</p>)
              }
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Xe buýt *</label>
            <select value={assignForm.bus_id} onChange={(e) => { setAssignForm({ ...assignForm, bus_id: e.target.value }); setCheckResult(null); }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Chọn xe —</option>
              {buses.map(b => <option key={b.bus_id} value={b.bus_id}>{b.bus_id} ({b.capacity} chỗ)</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tài xế *</label>
            <select value={assignForm.driver_code} onChange={(e) => { setAssignForm({ ...assignForm, driver_code: e.target.value }); setCheckResult(null); }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Chọn tài xế —</option>
              {drivers.map(d => <option key={d.driver_code} value={d.driver_code}>{d.driver_code} - {d.full_name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleCheck} className="flex-1 border border-blue-300 text-blue-600 hover:bg-blue-50 rounded-xl py-2 text-sm font-medium transition">
              🔍 Kiểm tra điều kiện
            </button>
            <button onClick={handleAssign} disabled={checkResult && !checkResult.valid}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl py-2 text-sm font-medium transition">
              ✅ Xác nhận phân công
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
