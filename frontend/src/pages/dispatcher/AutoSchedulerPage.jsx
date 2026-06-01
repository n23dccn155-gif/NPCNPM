import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, Modal, AlertBox } from '../../components/UI';
import { getPlans, getPlan, createPlan, generateTrips, submitPlan, reviewPlan } from '../../services/planService';
import { getRoutes } from '../../services/routeService';
import { getAvailableResources, assignGroup, replaceDriver, replaceBus } from '../../services/assignmentService';
import { useAuth } from '../../context/AuthContext';

export default function AutoSchedulerPage() {
  const { user } = useAuth();
  const isDispatcher = user?.role === 'dispatcher';
  const isManager = user?.role === 'manager';

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState([]);
  
  // Modals / Detail state
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [planDetail, setPlanDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ route_code: '', operation_date: new Date().toISOString().split('T')[0] });
  const [createError, setCreateError] = useState('');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningGroup, setAssigningGroup] = useState(null);
  const [availableResources, setAvailableResources] = useState({ buses: [], drivers: [] });
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [assignForm, setAssignForm] = useState({ bus_id: '', driver_id: '' });
  const [assignError, setAssignError] = useState('');

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewDecision, setReviewDecision] = useState('approve'); // approve / reject
  const [rejectReason, setRejectReason] = useState('');
  const [reviewError, setReviewError] = useState('');

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadPlans = () => {
    setLoading(true);
    getPlans()
      .then(res => setPlans(res.data?.data || res.data || []))
      .catch(err => {
        console.error(err);
        setErrorMsg('Không thể tải danh sách kế hoạch');
      })
      .finally(() => setLoading(false));
  };

  const loadRoutes = () => {
    getRoutes({ status: 'active' })
      .then(res => setRoutes(res.data?.data || res.data || []))
      .catch(console.error);
  };

  useEffect(() => {
    loadPlans();
    loadRoutes();
  }, []);

  const loadPlanDetail = (planId) => {
    setDetailLoading(true);
    getPlan(planId)
      .then(res => {
        setPlanDetail(res.data?.data || res.data || null);
        setSelectedPlanId(planId);
      })
      .catch(err => {
        console.error(err);
        setErrorMsg('Không thể tải chi tiết kế hoạch');
      })
      .finally(() => setDetailLoading(false));
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    setCreateError('');
    try {
      await createPlan(createForm);
      setShowCreateModal(false);
      loadPlans();
      setSuccessMsg('Đã khởi tạo kế hoạch nháp mới thành công.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Lỗi khi tạo kế hoạch');
    }
  };

  const handleGenerateTrips = async (planId) => {
    setDetailLoading(true);
    try {
      await generateTrips(planId);
      setSuccessMsg('Đã sinh chuyến xe và gom nhóm tự động thành công.');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadPlanDetail(planId);
      loadPlans();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Lỗi sinh chuyến');
      setTimeout(() => setErrorMsg(''), 4000);
      setDetailLoading(false);
    }
  };

  const openAssignModal = async (group) => {
    setAssigningGroup(group);
    setAssignForm({
      bus_id: group.bus_id ? String(group.bus_id) : '',
      driver_id: group.driver_id ? String(group.driver_id) : ''
    });
    setAssignError('');
    setShowAssignModal(true);
    setResourcesLoading(true);
    try {
      const isReplacement = !!(group.bus_id || group.driver_id);
      const res = await getAvailableResources(group.group_id, isReplacement);
      setAvailableResources(res.data?.data || res.data || { buses: [], drivers: [] });
    } catch (err) {
      console.error(err);
    } finally {
      setResourcesLoading(false);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setAssignError('');
    if (!assignForm.bus_id || !assignForm.driver_id) {
      setAssignError('Vui lòng chọn đầy đủ xe buýt và tài xế');
      return;
    }
    try {
      const payload = {
        group_id: assigningGroup.group_id,
        bus_id: Number(assignForm.bus_id),
        driver_id: Number(assignForm.driver_id)
      };

      if (assigningGroup.bus_id || assigningGroup.driver_id) {
        // Replacement mode
        if (Number(assignForm.driver_id) !== assigningGroup.driver_id) {
          await replaceDriver({ group_id: assigningGroup.group_id, new_driver_id: Number(assignForm.driver_id) });
        }
        if (Number(assignForm.bus_id) !== assigningGroup.bus_id) {
          await replaceBus({ group_id: assigningGroup.group_id, new_bus_id: Number(assignForm.bus_id) });
        }
      } else {
        // Initial assignment
        await assignGroup(payload);
      }
      setShowAssignModal(false);
      loadPlanDetail(selectedPlanId);
      setSuccessMsg('Cập nhật phân công tài nguyên thành công.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Không hợp lệ hoặc trùng lịch');
    }
  };

  const handleSubmitPlanForApproval = async (planId) => {
    try {
      await submitPlan(planId);
      setSuccessMsg('Gửi duyệt kế hoạch thành công.');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadPlans();
      loadPlanDetail(planId);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể gửi duyệt');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError('');
    if (reviewDecision === 'reject' && !rejectReason.trim()) {
      setReviewError('Vui lòng nhập lý do từ chối');
      return;
    }
    try {
      await reviewPlan(selectedPlanId, reviewDecision, rejectReason);
      setShowReviewModal(false);
      setSuccessMsg(reviewDecision === 'approve' ? 'Kế hoạch đã được phê duyệt thành công.' : 'Đã từ chối kế hoạch.');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadPlans();
      loadPlanDetail(selectedPlanId);
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Lỗi xử lý duyệt kế hoạch');
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'draft': return 'Kế hoạch nháp';
      case 'pending_approval': return 'Chờ phê duyệt';
      case 'approved': return 'Đã phê duyệt';
      case 'rejected': return 'Bị từ chối';
      default: return status;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'pending_approval': return 'bg-amber-100 text-amber-700';
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Kế hoạch vận doanh & Phân công"
        subtitle="Quản lý lịch trình, sinh các chuyến xe buýt, gom nhóm và phân bổ xe & tài xế"
        action={
          isDispatcher && (
            <button
              onClick={() => {
                setCreateForm({ route_code: routes[0]?.route_code || '', operation_date: new Date().toISOString().split('T')[0] });
                setCreateError('');
                setShowCreateModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/10 transition"
            >
              + Tạo kế hoạch mới
            </button>
          )
        }
      />

      {successMsg && <div className="mb-4"><AlertBox type="success" message={successMsg} /></div>}
      {errorMsg && <div className="mb-4"><AlertBox type="error" message={errorMsg} /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plans List Panel */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm h-fit">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center justify-between">
            Danh sách kế hoạch
            <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{plans.length}</span>
          </h2>

          {loading ? (
            <div className="text-center py-10 text-slate-400 font-semibold animate-pulse">Đang tải kế hoạch...</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">Chưa có kế hoạch vận doanh nào</div>
          ) : (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {plans.map(p => (
                <div
                  key={p.plan_id}
                  onClick={() => loadPlanDetail(p.plan_id)}
                  className={`p-4 rounded-xl border transition cursor-pointer text-left ${
                    selectedPlanId === p.plan_id
                      ? 'border-blue-500 bg-blue-50/30 shadow-sm'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-900 font-mono">Tuyến {p.route_code}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold ${getStatusBadge(p.status)}`}>
                      {getStatusText(p.status)}
                    </span>
                  </div>
                  <div className="font-semibold text-gray-600 text-xs mt-1.5">
                    Ngày chạy: {new Date(p.operation_date).toLocaleDateString('vi-VN')}
                  </div>
                  <div className="text-2xs text-gray-400 mt-2 flex justify-between">
                    <span>Tạo bởi: {p.creator_name}</span>
                    <span>ID: #{p.plan_id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plan Details & Group Assignments Panel */}
        <div className="lg:col-span-2 space-y-6">
          {detailLoading ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 font-semibold animate-pulse shadow-sm">
              Đang phân tích cấu trúc kế hoạch...
            </div>
          ) : planDetail ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
              {/* Detail Header */}
              <div className="flex justify-between items-start border-b pb-5">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    Chi tiết kế hoạch: Tuyến {planDetail.route_code} - {planDetail.route_name}
                  </h3>
                  <p className="text-sm font-semibold text-slate-500 mt-1">
                    Ngày chạy: {new Date(planDetail.operation_date).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isManager && planDetail.status === 'pending_approval' && (
                    <button
                      onClick={() => {
                        setReviewDecision('approve');
                        setRejectReason('');
                        setReviewError('');
                        setShowReviewModal(true);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow-md shadow-green-500/10"
                    >
                      Duyệt / Từ chối
                    </button>
                  )}

                  {isDispatcher && planDetail.status === 'draft' && (
                    <button
                      onClick={() => handleGenerateTrips(planDetail.plan_id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow-md shadow-blue-500/10"
                    >
                      {planDetail.groups?.length > 0 ? 'Tái sinh chuyến & Gom nhóm' : 'Sinh chuyến xe & Gom nhóm'}
                    </button>
                  )}

                  {isDispatcher && planDetail.status === 'draft' && planDetail.groups?.length > 0 && (
                    <button
                      onClick={() => handleSubmitPlanForApproval(planDetail.plan_id)}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow-md shadow-green-500/10"
                    >
                      Gửi kế hoạch phê duyệt
                    </button>
                  )}
                </div>
              </div>

              {planDetail.reject_reason && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-xs font-semibold">
                  🔴 Kế hoạch bị từ chối duyệt: "{planDetail.reject_reason}"
                </div>
              )}

              {planDetail.scheduling_metrics && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="text-2xs text-slate-400 font-bold uppercase">Lượt tối thiểu/chiều</div>
                    <div className="text-lg font-bold text-slate-800">{planDetail.scheduling_metrics.expected_trips_per_direction}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="text-2xs text-slate-400 font-bold uppercase">Giãn cách chốt</div>
                    <div className="text-lg font-bold text-slate-800">{planDetail.scheduling_metrics.headway_minutes}p</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="text-2xs text-slate-400 font-bold uppercase">Vòng xe</div>
                    <div className="text-lg font-bold text-slate-800">{planDetail.scheduling_metrics.round_trip_time_minutes}p</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <div className="text-2xs text-blue-500 font-bold uppercase">Xe gợi ý</div>
                    <div className="text-lg font-bold text-blue-700">{planDetail.scheduling_metrics.suggested_operating_buses}</div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                    <div className="text-2xs text-green-500 font-bold uppercase">Xe xác nhận</div>
                    <div className="text-lg font-bold text-green-700">{planDetail.scheduling_metrics.confirmed_operating_buses}</div>
                  </div>
                </div>
              )}

              {/* Trip Groups and Resource Assignment */}
              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-3">Phân công tài nguyên theo nhóm chuyến</h4>
                {planDetail.groups?.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl text-slate-400 text-xs">
                    Chưa có nhóm chuyến nào. Vui lòng nhấp "Sinh chuyến xe & Gom nhóm".
                  </div>
                ) : (
                  <div className="space-y-3">
                    {planDetail.groups?.map(g => {
                      const isUnassigned = !g.bus_id || !g.driver_id;
                      return (
                        <div key={g.group_id} className="border border-slate-100 hover:border-slate-200 bg-white rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition">
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{g.group_name}</div>
                            <div className="text-2xs font-semibold text-gray-500 mt-1 font-mono">
                              Khung chạy: {new Date(g.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(g.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-xs text-right">
                              <div>
                                <span className="text-slate-400 font-medium">Xe: </span>
                                <span className={g.license_plate ? 'font-bold text-slate-900' : 'text-red-500 font-bold'}>
                                  {g.license_plate || 'Chưa phân công'}
                                </span>
                              </div>
                              <div className="mt-0.5">
                                <span className="text-slate-400 font-medium">Tài xế: </span>
                                <span className={g.driver_name ? 'font-bold text-slate-900' : 'text-red-500 font-bold'}>
                                  {g.driver_name || 'Chưa phân công'}
                                </span>
                              </div>
                            </div>
                            
                            {isDispatcher && (planDetail.status === 'draft' || planDetail.status === 'approved') && (
                              <button
                                onClick={() => openAssignModal(g)}
                                className={`text-2xs font-bold px-3 py-1.5 rounded-lg transition border ${
                                  isUnassigned 
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-transparent' 
                                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                              >
                                {isUnassigned ? 'Phân công' : 'Thay đổi'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Individual Trips list */}
              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-3">Lịch trình chi tiết các chuyến ({planDetail.trips?.length || 0} chuyến)</h4>
                {planDetail.trips?.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-xl text-slate-400 text-xs">Không có lịch chuyến</div>
                ) : (
                  <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl divide-y">
                    {planDetail.trips?.map(t => (
                      <div key={t.trip_id} className="px-4 py-3 flex justify-between items-center text-xs hover:bg-slate-50 transition">
                        <div>
                          <span className="font-bold font-mono text-slate-700">ORDER #{t.trip_order}</span>
                          <span className="text-slate-400 ml-2">({t.direction_type === 'outbound' ? 'Chiều đi' : 'Chiều về'})</span>
                        </div>
                        <div className="font-semibold text-slate-800">
                          {new Date(t.scheduled_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(t.scheduled_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center text-slate-400 font-semibold shadow-sm">
              Chọn một kế hoạch vận doanh từ danh sách bên trái để xem chi tiết
            </div>
          )}
        </div>
      </div>

      {/* Create Plan Modal */}
      <Modal isOpen={showCreateModal} title="Tạo kế hoạch vận doanh mới" onClose={() => setShowCreateModal(false)}>
        <form onSubmit={handleCreatePlan} className="space-y-4">
          {createError && <AlertBox type="error" message={createError} />}
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Tuyến xe buýt *</label>
            <select
              value={createForm.route_code}
              onChange={e => setCreateForm({ ...createForm, route_code: e.target.value })}
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            >
              {routes.map(r => (
                <option key={r.route_code} value={r.route_code}>
                  Tuyến {r.route_code} - {r.route_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Ngày vận hành *</label>
            <input
              type="date"
              value={createForm.operation_date}
              onChange={e => setCreateForm({ ...createForm, operation_date: e.target.value })}
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          <div className="flex gap-3 justify-end pt-3">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/10 transition"
            >
              Tạo kế hoạch
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Modal */}
      <Modal isOpen={showAssignModal} title="Phân công xe & tài xế" onClose={() => setShowAssignModal(false)}>
        {resourcesLoading ? (
          <div className="text-center py-10 text-slate-400 font-semibold animate-pulse">Đang quét tài nguyên sẵn sàng...</div>
        ) : (
          <form onSubmit={handleAssignSubmit} className="space-y-4">
            {assignError && <AlertBox type="error" message={assignError} />}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-2xs text-blue-700 font-medium leading-relaxed mb-4">
              💡 Hệ thống chỉ gợi ý những xe thuộc tuyến này, có trạng thái hoạt động (active), và tài xế đang làm việc (working) không trùng lịch hoặc nghỉ phép.
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Chọn xe buýt *</label>
              <select
                value={assignForm.bus_id}
                onChange={e => setAssignForm({ ...assignForm, bus_id: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                <option value="">-- Chọn xe buýt khả dụng --</option>
                {availableResources.buses?.map(b => (
                  <option key={b.bus_id} value={b.bus_id}>
                    {b.license_plate} ({b.seat_count} chỗ, {b.bus_role === 'operating' ? 'Xe vận doanh' : 'Xe dự bị'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Chọn tài xế *</label>
              <select
                value={assignForm.driver_id}
                onChange={e => setAssignForm({ ...assignForm, driver_id: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                <option value="">-- Chọn tài xế khả dụng --</option>
                {availableResources.drivers?.map(d => (
                  <option key={d.driver_id} value={d.driver_id}>
                    {d.full_name} (Bằng {d.license_class})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 justify-end pt-3">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/10 transition"
              >
                Xác nhận phân công
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Review Modal (Manager only) */}
      <Modal isOpen={showReviewModal} title="Phê duyệt kế hoạch vận doanh" onClose={() => setShowReviewModal(false)}>
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          {reviewError && <AlertBox type="error" message={reviewError} />}
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Quyết định phê duyệt *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 font-semibold text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  value="approve"
                  checked={reviewDecision === 'approve'}
                  onChange={() => setReviewDecision('approve')}
                  className="w-4 h-4 text-blue-600"
                />
                Duyệt kế hoạch (approve)
              </label>
              <label className="flex items-center gap-2 font-semibold text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  value="reject"
                  checked={reviewDecision === 'reject'}
                  onChange={() => setReviewDecision('reject')}
                  className="w-4 h-4 text-red-600"
                />
                Từ chối kế hoạch (reject)
              </label>
            </div>
          </div>

          {reviewDecision === 'reject' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Lý do từ chối *</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                required
                rows={3}
                placeholder="Nhập lý do từ chối kế hoạch này..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          )}

          <div className="flex gap-3 justify-end pt-3">
            <button
              type="button"
              onClick={() => setShowReviewModal(false)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 text-white rounded-xl text-sm font-semibold shadow-md transition ${
                reviewDecision === 'approve' 
                  ? 'bg-green-600 hover:bg-green-700 shadow-green-500/10' 
                  : 'bg-red-600 hover:bg-red-700 shadow-red-500/10'
              }`}
            >
              Xác nhận quyết định
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
