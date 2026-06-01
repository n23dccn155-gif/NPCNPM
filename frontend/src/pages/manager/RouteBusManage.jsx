import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, ConfirmDialog, AlertBox } from '../../components/UI';
import { getRoutes } from '../../services/routeService';
import { getRouteBuses, addBusToRoute, removeBusFromRoute } from '../../services/routeBusService';
import { getBuses } from '../../services/busService';

export default function RouteBusManage() {
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeBuses, setRouteBuses] = useState([]);
  const [allRouteBuses, setAllRouteBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rbLoading, setRbLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add bus form
  const [addBusId, setAddBusId] = useState('');
  const [addBusRole, setAddBusRole] = useState('operating');
  const [addError, setAddError] = useState('');

  // Confirm delete
  const [confirm, setConfirm] = useState({ open: false, rb: null });
  const [warningModal, setWarningModal] = useState({ open: false, title: '', message: '' });

  const loadAllRouteBuses = async (routesList) => {
    try {
      const results = await Promise.all(
        routesList.map(r => getRouteBuses(r.route_code))
      );
      const allBusesAssigned = [];
      results.forEach(res => {
        const list = res.data?.data || res.data || [];
        list.forEach(item => {
          allBusesAssigned.push(item);
        });
      });
      setAllRouteBuses(allBusesAssigned);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    Promise.all([
      getRoutes(),
      getBuses()
    ]).then(([routeRes, busRes]) => {
      const routeData = routeRes.data?.data || routeRes.data || [];
      setRoutes(routeData);
      setBuses(busRes.data?.data || busRes.data || []);
      if (routeData.length > 0) {
        setSelectedRoute(routeData[0]);
      }
      loadAllRouteBuses(routeData);
    }).catch(() => setError('Không thể tải dữ liệu'))
      .finally(() => setLoading(false));
  }, []);

  const loadRouteBuses = async (routeCode) => {
    setRbLoading(true);
    try {
      const res = await getRouteBuses(routeCode);
      setRouteBuses(res.data?.data || res.data || []);
    } catch { setRouteBuses([]); }
    finally { setRbLoading(false); }
  };

  useEffect(() => {
    if (selectedRoute) loadRouteBuses(selectedRoute.route_code);
  }, [selectedRoute]);

  const handleAddBus = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!addBusId) { setAddError('Vui lòng chọn xe'); return; }

    // Check duplicate
    if (routeBuses.some(rb => rb.bus_id === Number(addBusId))) {
      setAddError('Xe này đã được bố trí cho tuyến này rồi');
      return;
    }

    // Check operating bus limit
    if (addBusRole === 'operating' && operatingCount >= requiredOperating) {
      setWarningModal({
        open: true,
        title: 'Không thể thêm xe vận doanh',
        message: `Số lượng xe vận doanh của tuyến này đã đạt giới hạn tối đa được xác nhận thiết lập khi thêm/sửa tuyến (${operatingCount}/${requiredOperating} xe).`
      });
      return;
    }

    try {
      await addBusToRoute(selectedRoute.route_code, { bus_id: Number(addBusId), bus_role: addBusRole });
      setAddBusId('');
      setAddBusRole('operating');
      loadRouteBuses(selectedRoute.route_code);
      loadAllRouteBuses(routes);
      setSuccessMsg('Đã bố trí xe vào tuyến thành công');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setAddError(err.response?.data?.message || 'Lỗi khi bố trí xe');
    }
  };

  const handleRemoveBus = async () => {
    try {
      await removeBusFromRoute(confirm.rb.route_code, confirm.rb.bus_id);
      setConfirm({ open: false, rb: null });
      loadRouteBuses(selectedRoute.route_code);
      loadAllRouteBuses(routes);
      setSuccessMsg('Đã gỡ xe khỏi tuyến');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi gỡ xe');
      setConfirm({ open: false, rb: null });
    }
  };

  // Compute stats
  const operatingCount = routeBuses.filter(rb => rb.bus_role === 'operating').length;
  const standbyCount = routeBuses.filter(rb => rb.bus_role === 'standby').length;
  const requiredOperating = selectedRoute?.confirmed_operating_buses || 0;
  const operatingWarning = selectedRoute && operatingCount < requiredOperating;

  // Available buses: not already assigned to ANY route
  const assignedBusIdsAcrossAllRoutes = allRouteBuses.map(rb => rb.bus_id);
  const availableBuses = buses.filter(b => b.status === 'active' && !assignedBusIdsAcrossAllRoutes.includes(b.bus_id));

  if (loading) return <Layout><div className="flex justify-center py-12 text-gray-500">Đang tải...</div></Layout>;

  return (
    <Layout>
      <PageHeader
        title="Bố trí đội xe tuyến"
        subtitle="Gán xe vận doanh (operating) và xe dự phòng (standby) cho từng tuyến"
      />

      {error && <AlertBox type="error" message={error} />}
      {successMsg && <div className="mb-4"><AlertBox type="success" message={successMsg} /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Route selector */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800">Danh sách tuyến</h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-50">
              {routes.map(r => (
                <button
                  key={r.route_code}
                  onClick={() => setSelectedRoute(r)}
                  className={`w-full text-left px-5 py-3.5 transition-all ${selectedRoute?.route_code === r.route_code
                    ? 'bg-blue-50 border-l-4 border-blue-600'
                    : 'hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-sm text-slate-800">Tuyến {r.route_code}</span>
                      <div className="text-xs text-slate-500 mt-0.5">{r.route_name}</div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Route bus management */}
        <div className="lg:col-span-8 space-y-5">
          {selectedRoute ? (
            <>
              {/* Route info card */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">
                      Tuyến {selectedRoute.route_code} — {selectedRoute.route_name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Luot di: {selectedRoute.outbound_start_point || '?'} - {selectedRoute.outbound_end_point || '?'}
                    </p>
                  </div>
                  <StatusBadge status={selectedRoute.status} />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className={`rounded-xl p-3 text-center ${operatingWarning ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-100'}`}>
                    <div className={`text-2xl font-bold ${operatingWarning ? 'text-red-600' : 'text-blue-700'}`}>{operatingCount}</div>
                    <div className="text-2xs font-semibold text-slate-500 mt-0.5">Xe vận doanh</div>
                    <div className="text-2xs text-slate-400 mt-0.5">Yêu cầu: {requiredOperating}</div>
                  </div>
                  <div className="rounded-xl p-3 text-center bg-green-50 border border-green-100">
                    <div className="text-2xl font-bold text-green-700">{standbyCount}</div>
                    <div className="text-2xs font-semibold text-slate-500 mt-0.5">Xe dự phòng</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-slate-700">{routeBuses.length}</div>
                    <div className="text-2xs font-semibold text-slate-500 mt-0.5">Tổng xe bố trí</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-slate-700">{availableBuses.length}</div>
                    <div className="text-2xs font-semibold text-slate-500 mt-0.5">Xe còn khả dụng</div>
                  </div>
                </div>

                {operatingWarning && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-semibold">
                    ⚠️ Số xe vận doanh ({operatingCount}) chưa đạt yêu cầu tối thiểu ({requiredOperating}) cho tuyến này!
                  </div>
                )}
              </div>

              {/* Add bus form */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h4 className="font-bold text-sm text-slate-800 mb-3">Thêm xe vào tuyến</h4>
                {addError && <div className="mb-3"><AlertBox type="error" message={addError} /></div>}
                <form onSubmit={handleAddBus} className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Chọn xe *</label>
                    <select
                      value={addBusId}
                      onChange={e => setAddBusId(e.target.value)}
                      required
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    >
                      <option value="">-- Chọn xe buýt khả dụng --</option>
                      {availableBuses.map(b => (
                        <option key={b.bus_id} value={b.bus_id}>
                          {b.license_plate} ({b.seat_count} chỗ)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-48">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Vai trò *</label>
                    <select
                      value={addBusRole}
                      onChange={e => setAddBusRole(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    >
                      <option value="operating">Xe vận doanh</option>
                      <option value="standby">Xe dự phòng</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-md shadow-blue-500/10">
                    + Bố trí xe
                  </button>
                </form>
              </div>

              {/* Assigned buses list */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h4 className="font-bold text-sm text-slate-800">Danh sách xe đã bố trí ({routeBuses.length})</h4>
                </div>
                {rbLoading ? (
                  <div className="text-center py-10 text-slate-400 font-semibold animate-pulse">Đang tải...</div>
                ) : routeBuses.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">Chưa có xe nào được bố trí cho tuyến này</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['Biển số xe', 'Số chỗ', 'Trạng thái xe', 'Vai trò', 'Thao tác'].map(h => (
                          <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {routeBuses.map(rb => (
                        <tr key={rb.route_bus_id} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-3.5 font-mono font-bold text-slate-800">{rb.license_plate}</td>
                          <td className="px-6 py-3.5 text-slate-600">{rb.seat_count} chỗ</td>
                          <td className="px-6 py-3.5"><StatusBadge status={rb.status} /></td>
                          <td className="px-6 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-bold ${rb.bus_role === 'operating' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                              }`}>
                              {rb.bus_role === 'operating' ? ' Vận doanh' : ' Dự phòng'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5">
                            <button
                              onClick={() => setConfirm({ open: true, rb })}
                              className="text-red-500 hover:text-red-700 text-xs font-bold transition"
                            >
                              Gỡ khỏi tuyến
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center text-slate-400 font-semibold">
              Chọn tuyến xe từ danh sách bên trái để xem bố trí đội xe
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirm.open}
        title="Gỡ xe khỏi tuyến?"
        message={`Bạn có chắc muốn gỡ xe "${confirm.rb?.license_plate}" khỏi tuyến này?`}
        onConfirm={handleRemoveBus}
        onCancel={() => setConfirm({ open: false, rb: null })}
        danger
      />

      <ConfirmDialog
        isOpen={warningModal.open}
        title={warningModal.title}
        message={warningModal.message}
        confirmText="Đồng ý"
        onConfirm={() => setWarningModal({ open: false, title: '', message: '' })}
        onCancel={() => setWarningModal({ open: false, title: '', message: '' })}
      />
    </Layout>
  );
}
