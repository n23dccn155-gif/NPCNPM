import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, Modal, AlertBox } from '../../components/UI';
import { getPlans, getPlan, createPlan, generateTrips, deletePlan, submitPlan, reviewPlan, autoAssignPlan } from '../../services/planService';
import { getRoutes } from '../../services/routeService';
import { useAuth } from '../../context/AuthContext';
import { getAvailableResources, replaceDriver, replaceBus } from '../../services/assignmentService';

const DAY_LABELS = ['CN','T2','T3','T4','T5','T6','T7'];

function formatTime(ts) {
  if (!ts) return '--:--';
  return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${DAY_LABELS[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`;
}

function getDateStr(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getEndDateStr(startDateStr) {
  if (!startDateStr) return '';
  const d = new Date(startDateStr);
  d.setDate(d.getDate() + 6);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
}

export default function AutoSchedulerPage() {
  const { user } = useAuth();
  const isDispatcher = user?.role === 'dispatcher';
  const isManager = user?.role === 'manager';

  const getPlanRangeStr = (startStr) => {
    if (!startStr) return '';
    const d1 = new Date(startStr);
    const d2 = new Date(startStr);
    d2.setDate(d2.getDate() + 6);
    return `${d1.toLocaleDateString('vi-VN')} - ${d2.toLocaleDateString('vi-VN')}`;
  };

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [planDetail, setPlanDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [selectedDayStr, setSelectedDayStr] = useState(null); // 'YYYY-MM-DD'

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ route_code: '', operation_date: new Date().toISOString().split('T')[0] });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewDecision, setReviewDecision] = useState('approve');
  const [rejectReason, setRejectReason] = useState('');
  const [reviewError, setReviewError] = useState('');

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [showEditAssignmentModal, setShowEditAssignmentModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [availableBuses, setAvailableBuses] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [selectedNewBusId, setSelectedNewBusId] = useState('');
  const [selectedNewDriverId, setSelectedNewDriverId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const handleOpenEditModal = (group) => {
    setEditingGroup(group);
    setSelectedNewBusId(group.bus_id || '');
    setSelectedNewDriverId(group.driver_id || '');
    setEditError('');
    setShowEditAssignmentModal(true);

    getAvailableResources(group.group_id, true)
      .then(res => {
        const data = res.data?.data || res.data || {};
        setAvailableBuses(data.buses || []);
        setAvailableDrivers(data.drivers || []);
      })
      .catch(err => {
        console.error(err);
        setEditError('Không thể tải danh sách xe và tài xế khả dụng');
      });
  };

  const handleSaveEditAssignment = async (e) => {
    e.preventDefault();
    if (!editingGroup) return;
    setSavingEdit(true);
    setEditError('');

    try {
      if (selectedNewBusId !== (editingGroup.bus_id || '')) {
        await replaceBus({
          group_id: editingGroup.group_id,
          new_bus_id: selectedNewBusId
        });
      }

      if (selectedNewDriverId !== (editingGroup.driver_id || '')) {
        await replaceDriver({
          group_id: editingGroup.group_id,
          new_driver_id: selectedNewDriverId
        });
      }

      flash(setSuccessMsg, 'Cập nhật phân công thành công!');
      setShowEditAssignmentModal(false);
      loadPlanDetail(selectedPlanId);
    } catch (err) {
      console.error(err);
      setEditError(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật phân công');
    } finally {
      setSavingEdit(false);
    }
  };

  const flash = (setter, msg, ms = 4000) => { setter(msg); setTimeout(() => setter(''), ms); };

  const loadPlans = () => {
    setLoading(true);
    getPlans()
      .then(res => setPlans(res.data?.data || res.data || []))
      .catch(() => flash(setErrorMsg, 'Không thể tải danh sách kế hoạch'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPlans();
    getRoutes({ status: 'active' }).then(res => setRoutes(res.data?.data || res.data || [])).catch(console.error);
  }, []);

  const loadPlanDetail = (planId) => {
    setDetailLoading(true);
    getPlan(planId)
      .then(res => {
        const detail = res.data?.data || res.data || null;
        setPlanDetail(detail);
        setSelectedPlanId(planId);
        // Tự chọn ngày đầu tiên
        if (detail?.groups?.length > 0) {
          setSelectedDayStr(getDateStr(detail.groups[0].start_time));
        }
      })
      .catch(() => flash(setErrorMsg, 'Không thể tải chi tiết kế hoạch'))
      .finally(() => setDetailLoading(false));
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      // 1. Tạo kế hoạch nháp
      const res = await createPlan(createForm);
      const planId = res.data?.data?.plan_id || res.data?.plan_id;
      if (!planId) {
        throw new Error('Không nhận được ID kế hoạch mới từ hệ thống.');
      }
      // 2. Tự động sinh lịch 7 ngày
      await generateTrips(planId);
      // 3. Tự động gán tài xế & xe xoay vòng
      await autoAssignPlan(planId);

      setShowCreateModal(false);
      loadPlans();
      loadPlanDetail(planId);
      flash(setSuccessMsg, 'Đã tạo kế hoạch mới, sinh chuyến và phân công tự động 7 ngày thành công!');
    } catch (err) {
      setCreateError(err.response?.data?.message || err.message || 'Lỗi khi tạo và lập lịch kế hoạch');
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateTrips = async () => {
    if (!selectedPlanId) return;
    setDetailLoading(true);
    try {
      await generateTrips(selectedPlanId);
      await autoAssignPlan(selectedPlanId);
      flash(setSuccessMsg, 'Đã tái sinh lịch 7 ngày và gán tài xế/xe xoay vòng thành công.');
      loadPlanDetail(selectedPlanId);
      loadPlans();
    } catch (err) {
      flash(setErrorMsg, err.response?.data?.message || 'Lỗi sinh lịch và phân công');
      setDetailLoading(false);
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('Xóa kế hoạch này?')) return;
    try {
      await deletePlan(planId);
      flash(setSuccessMsg, 'Đã xóa kế hoạch.');
      if (selectedPlanId === planId) { setPlanDetail(null); setSelectedPlanId(null); }
      loadPlans();
    } catch (err) { flash(setErrorMsg, err.response?.data?.message || 'Lỗi khi xóa'); }
  };

  const handleSubmitPlan = async () => {
    try {
      await submitPlan(selectedPlanId);
      flash(setSuccessMsg, 'Gửi duyệt kế hoạch thành công.');
      loadPlans(); loadPlanDetail(selectedPlanId);
    } catch (err) { flash(setErrorMsg, err.response?.data?.message || 'Không thể gửi duyệt'); }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError('');
    if (reviewDecision === 'reject' && !rejectReason.trim()) { setReviewError('Vui lòng nhập lý do từ chối'); return; }
    try {
      await reviewPlan(selectedPlanId, reviewDecision, rejectReason);
      setShowReviewModal(false);
      flash(setSuccessMsg, reviewDecision === 'approve' ? 'Đã phê duyệt kế hoạch.' : 'Đã từ chối kế hoạch.');
      loadPlans(); loadPlanDetail(selectedPlanId);
    } catch (err) { setReviewError(err.response?.data?.message || 'Lỗi duyệt kế hoạch'); }
  };

  // Nhóm groups theo ngày
  const dayGroups = {};
  if (planDetail?.groups) {
    for (const g of planDetail.groups) {
      const ds = getDateStr(g.start_time);
      if (!dayGroups[ds]) dayGroups[ds] = [];
      dayGroups[ds].push(g);
    }
  }
  const dayKeys = Object.keys(dayGroups).sort();

  const activeGroups = selectedDayStr ? (dayGroups[selectedDayStr] || []) : [];
  const operatingGroups = activeGroups.filter(g => g.status !== 'standby');
  const standbyGroups = activeGroups.filter(g => g.status === 'standby');
  const activeTrips = planDetail?.trips?.filter(t => {
    if (!selectedDayStr) return true;
    return getDateStr(t.scheduled_departure) === selectedDayStr;
  }) || [];

  const statusText = { draft: 'Kế hoạch nháp', pending_approval: 'Chờ phê duyệt', approved: 'Đã phê duyệt', rejected: 'Bị từ chối' };
  const statusBadge = { draft: 'bg-gray-100 text-gray-700', pending_approval: 'bg-amber-100 text-amber-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' };

  return (
    <Layout>
      <PageHeader
        title="Kế hoạch vận doanh & Phân công"
        subtitle="Sinh lịch 7 ngày, xoay vòng xe & tài xế tự động"
        action={isDispatcher && (
          <button onClick={() => { setCreateForm({ route_code: routes[0]?.route_code || '', operation_date: new Date().toISOString().split('T')[0] }); setCreateError(''); setShowCreateModal(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition">
            + Tạo kế hoạch mới
          </button>
        )}
      />

      {successMsg && <div className="mb-4"><AlertBox type="success" message={successMsg} /></div>}
      {errorMsg && <div className="mb-4"><AlertBox type="error" message={errorMsg} /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Danh sách kế hoạch */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm h-fit">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center justify-between">
            Danh sách kế hoạch
            <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{plans.length}</span>
          </h2>
          {loading ? (
            <div className="text-center py-10 text-slate-400 animate-pulse font-semibold">Đang tải...</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">Chưa có kế hoạch nào</div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {plans.map(p => (
                <div key={p.plan_id}
                  onClick={() => loadPlanDetail(p.plan_id)}
                  className={`p-3 rounded-xl border transition cursor-pointer relative ${selectedPlanId === p.plan_id ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 hover:border-slate-200'}`}>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-900 font-mono text-sm">Tuyến {p.route_code}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge[p.status]}`}>{statusText[p.status]}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Từ: {new Date(p.operation_date).toLocaleDateString('vi-VN')}</div>
                  <div className="text-xs text-gray-400 mt-2 flex justify-between items-center">
                    <span>{p.creator_name} <span className="text-slate-300 font-mono ml-1">#{p.plan_id}</span></span>
                    {isDispatcher && ['draft','rejected'].includes(p.status) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePlan(p.plan_id); }}
                        className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-0.5 border border-red-100 hover:border-red-200 rounded transition">
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chi tiết kế hoạch */}
        <div className="lg:col-span-2 space-y-4">
          {detailLoading ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 font-semibold animate-pulse">Đang tải chi tiết...</div>
          ) : planDetail ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
              {/* Header */}
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Tuyến {planDetail.route_code} — {planDetail.route_name}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Chu kỳ 7 ngày: <span className="font-semibold text-slate-700">{getPlanRangeStr(planDetail.operation_date)}</span></p>
                  <span className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge[planDetail.status]}`}>{statusText[planDetail.status]}</span>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {isDispatcher && planDetail.status === 'draft' && (
                    <>
                      <button onClick={handleGenerateTrips}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition">
                        🔄 Tái phân công xoay vòng
                      </button>
                      {planDetail.groups?.length > 0 && (
                        <button onClick={handleSubmitPlan}
                          className="bg-green-600 hover:bg-green-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition">
                          📤 Gửi phê duyệt cả tuần (7 ngày)
                        </button>
                      )}
                    </>
                  )}
                  {isManager && planDetail.status === 'pending_approval' && (
                    <button onClick={() => { setReviewDecision('approve'); setRejectReason(''); setReviewError(''); setShowReviewModal(true); }}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition">
                      Duyệt / Từ chối
                    </button>
                  )}
                </div>
              </div>

              {planDetail.reject_reason && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs font-semibold">
                  🔴 Bị từ chối: "{planDetail.reject_reason}"
                </div>
              )}

              {/* Thống kê */}
              {planDetail.scheduling_metrics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Lượt/chiều', val: planDetail.scheduling_metrics.expected_trips_per_direction, color: 'slate' },
                    { label: 'Giãn cách (phút)', val: `${planDetail.scheduling_metrics.headway_minutes}p`, color: 'slate' },
                    { label: 'Xe vận doanh', val: planDetail.scheduling_metrics.confirmed_operating_buses, color: 'green' },
                    { label: 'Nhóm/ngày', val: operatingGroups.length || '—', color: 'blue' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className={`bg-${color}-50 rounded-xl p-3 border border-${color}-100`}>
                      <div className={`text-2xs text-${color}-400 font-bold uppercase`}>{label}</div>
                      <div className={`text-lg font-bold text-${color}-700`}>{val}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab chọn ngày */}
              {dayKeys.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-800 text-sm mb-2">📅 Xem theo ngày</h4>
                  <div className="flex gap-2 flex-wrap">
                    {dayKeys.map(ds => (
                      <button key={ds}
                        onClick={() => setSelectedDayStr(ds)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${selectedDayStr === ds ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                        {formatDate(ds + 'T00:00:00')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Phân công ngày được chọn */}
              {selectedDayStr && dayGroups[selectedDayStr] && (
                <>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm mb-2">🚌 Phân công xe & tài xế — {formatDate(selectedDayStr + 'T00:00:00')}</h4>
                    {operatingGroups.length === 0 ? (
                      <div className="text-center py-6 bg-slate-50 rounded-xl text-slate-400 text-xs">Chưa có phân công</div>
                    ) : (
                      <div className="space-y-2">
                        {operatingGroups.map(g => (
                          <div key={g.group_id} className="border border-slate-100 bg-slate-50 rounded-xl px-4 py-3 flex justify-between items-center">
                            <div>
                              <div className="font-bold text-slate-800 text-sm">{g.group_name}</div>
                              <div className="text-xs text-gray-500 font-mono mt-0.5">
                                {formatTime(g.start_time)} → {formatTime(g.end_time)}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-xs text-right space-y-0.5">
                                <div>
                                  <span className="text-slate-400">Xe: </span>
                                  <span className={g.license_plate ? 'font-bold text-slate-900' : 'text-red-500 font-bold'}>
                                    {g.license_plate || 'Chưa gán'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400">Tài xế: </span>
                                  <span className={g.driver_name ? 'font-bold text-slate-900' : 'text-red-500 font-bold'}>
                                    {g.driver_name || 'Chưa gán'}
                                  </span>
                                </div>
                              </div>
                              {isDispatcher && planDetail.status === 'draft' && (
                                <button
                                  onClick={() => handleOpenEditModal(g)}
                                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-semibold transition"
                                >
                                  Chỉnh sửa
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mốc thời gian chuyến */}
                  {activeTrips.length > 0 && (
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm mb-2">🕐 Lịch chuyến ({activeTrips.length} chuyến)</h4>
                      <div className="max-h-52 overflow-y-auto border border-slate-100 rounded-xl divide-y">
                        {activeTrips.map(t => (
                          <div key={t.trip_id} className="px-4 py-2 flex justify-between items-center text-xs hover:bg-slate-50">
                            <div>
                              <span className="font-bold font-mono text-slate-700">#{t.trip_order}</span>
                              <span className="text-slate-400 ml-2">({t.direction_type === 'outbound' ? 'Chiều đi' : 'Chiều về'})</span>
                              {t.group_name && <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{t.group_name}</span>}
                            </div>
                            <div className="font-semibold text-slate-800 font-mono">
                              {formatTime(t.scheduled_departure)} → {formatTime(t.scheduled_arrival)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dự phòng ngày */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h4 className="font-bold text-amber-800 text-sm mb-2">⚠️ Dự phòng ngày {formatDate(selectedDayStr + 'T00:00:00')}</h4>
                    {standbyGroups.length === 0 ? (
                      <p className="text-xs text-amber-600">Chưa có thông tin dự phòng</p>
                    ) : (
                      <div className="space-y-1">
                        {standbyGroups.map(g => (
                          <div key={g.group_id} className="flex gap-4 text-xs">
                            {g.driver_name && <span className="text-amber-800"><span className="font-semibold">Tài xế nghỉ/dự phòng:</span> {g.driver_name}</span>}
                            {g.license_plate && <span className="text-amber-800"><span className="font-semibold">Xe dự phòng:</span> {g.license_plate}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {planDetail.groups?.length === 0 && (
                <div className="text-center py-10 bg-slate-50 rounded-xl text-slate-400 text-xs">
                  Chưa có lịch. Nhấn "🔄 Tái phân công xoay vòng" để tạo.
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center text-slate-400 font-semibold shadow-sm">
              Chọn một kế hoạch từ danh sách bên trái để xem chi tiết
            </div>
          )}
        </div>
      </div>

      {/* Modal tạo kế hoạch */}
      <Modal isOpen={showCreateModal} title="Tạo kế hoạch vận doanh mới" onClose={() => !creating && setShowCreateModal(false)}>
        <form onSubmit={handleCreatePlan} className="space-y-4">
          {createError && <AlertBox type="error" message={createError} />}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Tuyến xe buýt *</label>
            <select value={createForm.route_code} onChange={e => setCreateForm({ ...createForm, route_code: e.target.value })} required disabled={creating}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-60">
              <option value="" disabled>-- Chọn tuyến xe buýt --</option>
              {routes.map(r => <option key={r.route_code} value={r.route_code}>Tuyến {r.route_code} - {r.route_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Ngày bắt đầu tuần *</label>
            <input type="date" value={createForm.operation_date} onChange={e => setCreateForm({ ...createForm, operation_date: e.target.value })} required disabled={creating}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-60" />
            <p className="text-xs text-slate-400 mt-1">Hệ thống sẽ sinh lịch 7 ngày từ ngày này</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider font-medium text-slate-500">Ngày kết thúc tuần (Tự động)</label>
            <input type="date" value={getEndDateStr(createForm.operation_date)} disabled
              className="w-full border border-slate-200 bg-slate-50 text-slate-400 rounded-xl px-4 py-2.5 text-sm cursor-not-allowed focus:outline-none" />
            <p className="text-xs text-slate-400 mt-1">Chu kỳ 7 ngày được tự động cấu hình</p>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowCreateModal(false)} disabled={creating}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition disabled:opacity-50">Hủy</button>
            <button type="submit" disabled={creating}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md transition disabled:bg-blue-400 flex items-center gap-2">
              {creating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang khởi tạo & lập lịch...
                </>
              ) : 'Tạo kế hoạch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal duyệt */}
      <Modal isOpen={showReviewModal} title="Phê duyệt kế hoạch vận doanh" onClose={() => setShowReviewModal(false)}>
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          {reviewError && <AlertBox type="error" message={reviewError} />}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Quyết định *</label>
            <div className="flex gap-4">
              {['approve','reject'].map(v => (
                <label key={v} className="flex items-center gap-2 font-semibold text-sm text-slate-700 cursor-pointer">
                  <input type="radio" name="decision" value={v} checked={reviewDecision === v} onChange={() => setReviewDecision(v)} className="w-4 h-4" />
                  {v === 'approve' ? 'Duyệt kế hoạch' : 'Từ chối kế hoạch'}
                </label>
              ))}
            </div>
          </div>
          {reviewDecision === 'reject' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Lý do từ chối *</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} required rows={3}
                placeholder="Nhập lý do..." className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowReviewModal(false)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition">Hủy</button>
            <button type="submit"
              className={`px-5 py-2.5 text-white rounded-xl text-sm font-semibold shadow-md transition ${reviewDecision === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              Xác nhận quyết định
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal điều chỉnh phân công */}
      <Modal isOpen={showEditAssignmentModal} title={`Điều chỉnh phân công - ${editingGroup?.group_name || ''}`} onClose={() => !savingEdit && setShowEditAssignmentModal(false)}>
        <form onSubmit={handleSaveEditAssignment} className="space-y-4">
          {editError && <AlertBox type="error" message={editError} />}
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Xe buýt hoạt động *</label>
            <select value={selectedNewBusId} onChange={e => setSelectedNewBusId(e.target.value)} required disabled={savingEdit}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-60 font-medium text-slate-800">
              <option value="" disabled>-- Chọn xe buýt --</option>
              {availableBuses.map(b => (
                <option key={b.bus_id} value={b.bus_id}>
                  {b.license_plate} {b.bus_role === 'standby' ? '(Dự phòng)' : ''}
                </option>
              ))}
              {editingGroup?.bus_id && !availableBuses.some(b => b.bus_id === editingGroup.bus_id) && (
                <option value={editingGroup.bus_id}>
                  {editingGroup.license_plate} (Hiện tại)
                </option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Tài xế lái chính *</label>
            <select value={selectedNewDriverId} onChange={e => setSelectedNewDriverId(e.target.value)} required disabled={savingEdit}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-60 font-medium text-slate-800">
              <option value="" disabled>-- Chọn tài xế --</option>
              {availableDrivers.map(d => (
                <option key={d.driver_id} value={d.driver_id}>
                  {d.full_name}
                </option>
              ))}
              {editingGroup?.driver_id && !availableDrivers.some(d => d.driver_id === editingGroup.driver_id) && (
                <option value={editingGroup.driver_id}>
                  {editingGroup.driver_name} (Hiện tại)
                </option>
              )}
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowEditAssignmentModal(false)} disabled={savingEdit}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition disabled:opacity-50">Hủy</button>
            <button type="submit" disabled={savingEdit}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md transition disabled:bg-blue-400 flex items-center gap-2">
              {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
