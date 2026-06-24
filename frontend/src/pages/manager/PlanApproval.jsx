import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, Modal, AlertBox } from '../../components/UI';
import { getPlans, getPlan, reviewPlan } from '../../services/planService';
import { getRoutes } from '../../services/routeService';

export default function PlanApproval() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState([]);

  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [planDetail, setPlanDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewDecision, setReviewDecision] = useState('approve');
  const [rejectReason, setRejectReason] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [highlightedDriver, setHighlightedDriver] = useState(null);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [filterStatus, setFilterStatus] = useState('');

  const loadPlans = () => {
    setLoading(true);
    getPlans()
      .then(res => setPlans(res.data?.data || res.data || []))
      .catch(() => setErrorMsg('Không thể tải danh sách kế hoạch'))
      .finally(() => setLoading(false));
  };

  const loadRoutes = () => {
    getRoutes({ status: 'active' })
      .then(res => setRoutes(res.data?.data || res.data || []))
      .catch(console.error);
  };

  useEffect(() => { loadPlans(); loadRoutes(); }, []);

  const loadPlanDetail = (planId) => {
    setDetailLoading(true);
    getPlan(planId)
      .then(res => {
        setPlanDetail(res.data?.data || res.data || null);
        setSelectedPlanId(planId);
      })
      .catch(() => setErrorMsg('Không thể tải chi tiết kế hoạch'))
      .finally(() => setDetailLoading(false));
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError('');
    if (reviewDecision === 'reject' && !rejectReason.trim()) {
      setReviewError('Vui lòng nhập lý do từ chối');
      return;
    }
    try {
      await reviewPlan(planDetail.plan_id, { decision: reviewDecision, reject_reason: rejectReason });
      setShowReviewModal(false);
      setSuccessMsg(reviewDecision === 'approve' ? 'Đã duyệt kế hoạch vận doanh thành công.' : 'Đã từ chối kế hoạch vận doanh.');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadPlanDetail(planDetail.plan_id);
      loadPlans();
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Lỗi khi phê duyệt kế hoạch');
    }
  };

  const statusLabel = {
    draft: 'Nháp',
    pending_approval: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Bị từ chối'
  };

  const statusColor = {
    draft: 'bg-slate-100 text-slate-600',
    pending_approval: 'bg-amber-50 text-amber-700',
    approved: 'bg-green-50 text-green-700',
    rejected: 'bg-red-50 text-red-700'
  };

  const getRouteName = (code) => {
    const r = routes.find(rt => rt.route_code === code);
    return r ? `Tuyến ${r.route_code} – ${r.route_name}` : `Tuyến ${code}`;
  };

  const filteredPlans = plans.filter(p => !filterStatus || p.status === filterStatus);

  return (
    <Layout>
      <PageHeader
        title="Phê duyệt kế hoạch vận doanh"
        subtitle="Xem, duyệt hoặc từ chối kế hoạch do Nhân viên điều phối gửi lên"
      />

      {successMsg && <div className="mb-4"><AlertBox type="success" message={successMsg} /></div>}
      {errorMsg && <div className="mb-4"><AlertBox type="error" message={errorMsg} /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Plan list */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800">Kế hoạch ({filteredPlans.length})</h3>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả</option>
                <option value="pending_approval">Chờ duyệt</option>
                <option value="approved">Đã duyệt</option>
                <option value="rejected">Bị từ chối</option>
                <option value="draft">Nháp</option>
              </select>
            </div>
            <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-50">
              {loading ? (
                <div className="text-center py-10 text-slate-400 animate-pulse font-semibold">Đang tải...</div>
              ) : filteredPlans.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">Không có kế hoạch nào</div>
              ) : (
                filteredPlans.map(p => (
                  <button
                    key={p.plan_id}
                    onClick={() => loadPlanDetail(p.plan_id)}
                    className={`w-full text-left px-5 py-3.5 transition-all ${
                      selectedPlanId === p.plan_id
                        ? 'bg-blue-50 border-l-4 border-blue-600'
                        : 'hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-slate-800">{getRouteName(p.route_code)}</div>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono">
                          Ngày: {new Date(p.operation_date).toLocaleDateString('vi-VN')}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-2xs font-bold ${statusColor[p.status]}`}>
                        {statusLabel[p.status]}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Plan detail */}
        <div className="lg:col-span-8 space-y-5">
          {detailLoading ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center text-slate-400 font-semibold animate-pulse">
              Đang tải chi tiết kế hoạch...
            </div>
          ) : planDetail ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">{getRouteName(planDetail.route_code)}</h3>
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                      Ngày vận hành: {new Date(planDetail.operation_date).toLocaleDateString('vi-VN')}
                      {planDetail.submitted_by_name && ` • Gửi bởi: ${planDetail.submitted_by_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold ${statusColor[planDetail.status]}`}>
                      {statusLabel[planDetail.status]}
                    </span>
                    {planDetail.status === 'pending_approval' && (
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
                  </div>
                </div>

                {planDetail.reject_reason && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-xs font-semibold">
                    🔴 Kế hoạch bị từ chối: "{planDetail.reject_reason}"
                  </div>
                )}
              </div>

              {planDetail.scheduling_metrics && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <h4 className="font-bold text-sm text-slate-800 mb-3">Chỉ số vận doanh</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="text-2xs text-slate-400 font-bold uppercase">Số lượt xuất bến mỗi chiều</div>
                      <div className="text-lg font-bold text-slate-800">{planDetail.scheduling_metrics.expected_trips_per_direction}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="text-2xs text-slate-400 font-bold uppercase">Thời gian giãn cách chuyến</div>
                      <div className="text-lg font-bold text-slate-800">{planDetail.scheduling_metrics.headway_minutes}p</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="text-2xs text-slate-400 font-bold uppercase">Vòng xe</div>
                      <div className="text-lg font-bold text-slate-800">{planDetail.scheduling_metrics.round_trip_time_minutes}p</div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                      <div className="text-2xs text-green-500 font-bold uppercase">Số xe vận doanh</div>
                      <div className="text-lg font-bold text-green-700">{planDetail.scheduling_metrics.confirmed_operating_buses}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Groups */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h4 className="font-bold text-sm text-slate-800 mb-3">Nhóm chuyến & Phân công ({planDetail.groups?.length || 0} nhóm)</h4>
                {!planDetail.groups?.length ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl text-slate-400 text-xs">Chưa có nhóm chuyến nào</div>
                ) : (
                  <div className="space-y-3">
                    {planDetail.groups.map(g => (
                      <div 
                        key={g.group_id} 
                        className={`border border-slate-100 rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 cursor-pointer transition ${highlightedDriver && g.driver_name === highlightedDriver ? 'bg-yellow-100 border-yellow-300' : 'bg-white'}`}
                        onClick={() => {
                          if (g.driver_name) {
                            setHighlightedDriver(g.driver_name === highlightedDriver ? null : g.driver_name);
                          }
                        }}
                      >
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{g.group_name}</div>
                          <div className="text-2xs font-semibold text-gray-500 mt-1 font-mono">
                            {new Date(g.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} – {new Date(g.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
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
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Trips */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h4 className="font-bold text-sm text-slate-800 mb-3">Lịch trình chi tiết ({planDetail.trips?.length || 0} chuyến)</h4>
                {!planDetail.trips?.length ? (
                  <div className="text-center py-6 bg-slate-50 rounded-xl text-slate-400 text-xs">Không có lịch chuyến</div>
                ) : (
                  <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl divide-y">
                    {planDetail.trips.map(t => {
                      const group = planDetail.groups?.find(g => g.group_id === t.group_id);
                      return (
                        <div 
                          key={t.trip_id} 
                          className={`px-4 py-3 flex justify-between items-center text-xs hover:bg-slate-50 transition cursor-pointer ${highlightedDriver && group?.driver_name === highlightedDriver ? 'bg-yellow-100' : ''}`}
                          onClick={() => {
                            if (group?.driver_name) {
                              setHighlightedDriver(group.driver_name === highlightedDriver ? null : group.driver_name);
                            }
                          }}
                        >
                          <div>
                            <span className="font-bold font-mono text-slate-700">Chuyến #{t.trip_order}</span>
                            <span className="text-slate-400 ml-2">({t.direction_type === 'outbound' ? 'Chiều đi' : 'Chiều về'})</span>
                            {t.group_name && (
                              <span className="ml-3 px-2 py-0.5 rounded-lg text-3xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                                {t.group_name}
                              </span>
                            )}
                          </div>
                          <div className="font-semibold text-slate-800">
                            {new Date(t.scheduled_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} – {new Date(t.scheduled_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center text-slate-400 font-semibold">
              Chọn một kế hoạch vận doanh từ danh sách bên trái để xem chi tiết và phê duyệt
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      <Modal isOpen={showReviewModal} title="Phê duyệt kế hoạch vận doanh" onClose={() => setShowReviewModal(false)}>
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          {reviewError && <AlertBox type="error" message={reviewError} />}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Quyết định *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 font-semibold text-sm text-slate-700 cursor-pointer">
                <input type="radio" name="decision" value="approve" checked={reviewDecision === 'approve'} onChange={() => setReviewDecision('approve')} className="w-4 h-4 text-blue-600" />
                ✅ Duyệt kế hoạch
              </label>
              <label className="flex items-center gap-2 font-semibold text-sm text-slate-700 cursor-pointer">
                <input type="radio" name="decision" value="reject" checked={reviewDecision === 'reject'} onChange={() => setReviewDecision('reject')} className="w-4 h-4 text-red-600" />
                ❌ Từ chối
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
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          )}

          <div className="flex gap-3 justify-end pt-3">
            <button type="button" onClick={() => setShowReviewModal(false)} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition">
              Hủy
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 text-white rounded-xl text-sm font-semibold shadow-md transition ${
                reviewDecision === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {reviewDecision === 'approve' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
