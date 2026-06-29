import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/Layout';
import { formatDate } from '../../utils/format';
import { PageHeader, Modal, AlertBox } from '../../components/UI';
import { getPlans, getPlan, reviewPlan, reviewBatchPlans } from '../../services/planService';
import { getRoutes } from '../../services/routeService';

export default function PlanApproval() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState([]);

  const [selectedGroup, setSelectedGroup] = useState(null);
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

  const leaves = useMemo(() => planDetail?.approved_leaves || [], [planDetail]);
  const isLeaveDriver = (name) => leaves.some(l => l.driver_name === name);

  const outboundTrips = useMemo(() => {
    return planDetail?.trips?.filter(t => t.direction_type === 'outbound') || [];
  }, [planDetail]);

  const inboundTrips = useMemo(() => {
    return planDetail?.trips?.filter(t => t.direction_type === 'inbound') || [];
  }, [planDetail]);

  const renderTripTable = (trips, title) => (
    <div className="flex-1 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-100 p-3 font-bold text-slate-700 text-center text-xs">
        {title} ({trips.length} chuyến)
      </div>
      <div className="max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 sticky top-0 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3">Giờ xuất bến</th>
              <th className="p-3">Mã nhóm</th>
              <th className="p-3">Biển số</th>
              <th className="p-3">Tài xế</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trips.map(t => {
              const group = planDetail.groups?.find(g => g.group_id === t.group_id);
              return (
                <tr
                  key={t.trip_id}
                  className={`hover:bg-slate-50 cursor-pointer transition ${highlightedDriver && group?.driver_name === highlightedDriver ? 'bg-yellow-50' : ''}`}
                  onClick={() => {
                    if (group?.driver_name) {
                      setHighlightedDriver(group.driver_name === highlightedDriver ? null : group.driver_name);
                    }
                  }}
                >
                  <td className="p-3 font-semibold text-blue-600">
                    {t.status === 'cancelled' && <span className="text-red-500 font-bold mr-1">[HỦY]</span>}
                    {t.scheduled_departure ? new Date(t.scheduled_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="p-3">
                    <span className={t.status === 'cancelled' ? 'line-through text-slate-400' : ''}>
                      {t.group_name || '-'}
                    </span>
                  </td>
                  <td className="p-3 font-semibold text-slate-700">
                    {group?.license_plate || <span className="text-slate-400 font-normal italic">Chưa xếp</span>}
                  </td>
                  <td className="p-3">
                    <span className={group?.driver_name && isLeaveDriver(group.driver_name) ? 'text-red-600 font-bold' : 'text-slate-700 font-medium'}>
                      {group?.driver_name || <span className="text-slate-400 font-normal italic">Chưa xếp</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

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

  const handleGroupClick = (group) => {
    setSelectedGroup(group);
    loadPlanDetail(group.id);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError('');
    if (reviewDecision === 'reject' && !rejectReason.trim()) {
      setReviewError('Vui lòng nhập lý do từ chối');
      return;
    }
    try {
      if (selectedGroup && selectedGroup.count > 1) {
        await reviewBatchPlans({ planIds: selectedGroup.planIds, decision: reviewDecision, reject_reason: rejectReason });
      } else {
        await reviewPlan(planDetail.plan_id, { decision: reviewDecision, reject_reason: rejectReason });
      }
      setShowReviewModal(false);
      setSuccessMsg(reviewDecision === 'approve' ? 'Đã duyệt kế hoạch vận doanh thành công.' : 'Đã từ chối kế hoạch vận doanh.');
      setTimeout(() => setSuccessMsg(''), 4000);
      setSelectedGroup(null);
      setPlanDetail(null);
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

  const groupedPlans = useMemo(() => {
    const sorted = [...filteredPlans].sort((a, b) => {
      if (a.route_code !== b.route_code) return a.route_code.localeCompare(b.route_code);
      return new Date(a.operation_date) - new Date(b.operation_date);
    });

    const groups = [];
    let currentGroup = null;

    sorted.forEach(plan => {
      const planDate = new Date(plan.operation_date);
      planDate.setHours(0, 0, 0, 0);

      if (!currentGroup) {
        currentGroup = {
          id: plan.plan_id,
          route_code: plan.route_code,
          status: plan.status,
          startDate: planDate,
          endDate: planDate,
          count: 1,
          planIds: [plan.plan_id],
          plansList: [{ id: plan.plan_id, date: planDate }],
          representativePlan: plan
        };
        groups.push(currentGroup);
      } else {
        const diffDays = Math.round((planDate - currentGroup.endDate) / (1000 * 60 * 60 * 24));

        if (
          plan.route_code === currentGroup.route_code &&
          plan.status === currentGroup.status &&
          diffDays === 1
        ) {
          currentGroup.endDate = planDate;
          currentGroup.count += 1;
          currentGroup.planIds.push(plan.plan_id);
          currentGroup.plansList.push({ id: plan.plan_id, date: planDate });
        } else {
          currentGroup = {
            id: plan.plan_id,
            route_code: plan.route_code,
            status: plan.status,
            startDate: planDate,
            endDate: planDate,
            count: 1,
            planIds: [plan.plan_id],
            plansList: [{ id: plan.plan_id, date: planDate }],
            representativePlan: plan
          };
          groups.push(currentGroup);
        }
      }
    });

    return groups;
  }, [filteredPlans]);

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
              ) : groupedPlans.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">Không có kế hoạch nào</div>
              ) : (
                groupedPlans.map((g, idx) => (
                  <button
                    key={`${g.id}-${idx}`}
                    onClick={() => handleGroupClick(g)}
                    className={`w-full text-left px-5 py-3.5 transition-all ${selectedGroup?.id === g.id
                        ? 'bg-blue-50 border-l-4 border-blue-600'
                        : 'hover:bg-slate-50 border-l-4 border-transparent'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-slate-800">{getRouteName(g.route_code)}</div>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono">
                          {g.count > 1 ? (
                            `Từ ${formatDate(g.startDate)} đến ${formatDate(g.endDate)} (${g.count} ngày)`
                          ) : (
                            `Ngày: ${formatDate(g.startDate)}`
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-2xs font-bold ${statusColor[g.status]}`}>
                        {statusLabel[g.status]}
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
                      {selectedGroup?.count > 1 ? (
                        `Ngày vận hành: Từ ${formatDate(selectedGroup.startDate)} đến ${formatDate(selectedGroup.endDate)} (${selectedGroup.count} ngày)`
                      ) : (
                        `Ngày vận hành: ${formatDate(planDetail.operation_date)}`
                      )}
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
                        {selectedGroup?.count > 1 ? `Duyệt ${selectedGroup.count} kế hoạch` : 'Duyệt / Từ chối'}
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

              {/* Date Selector for Batch */}
              {selectedGroup?.count > 1 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 overflow-x-auto whitespace-nowrap">
                  <div className="flex gap-2">
                    {selectedGroup.plansList.map(p => (
                      <button
                        key={p.id}
                        onClick={() => loadPlanDetail(p.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${selectedPlanId === p.id
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                      >
                        {formatDate(p.date)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

              {/* Leaves & Incidents Alerts */}
              {leaves.length > 0 && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl">
                  <h4 className="font-bold text-amber-800 text-xs uppercase tracking-wider mb-1.5">Thông tin nghỉ phép</h4>
                  <p className="text-xs text-amber-700 font-medium">Danh sách tài xế xin nghỉ trong ngày:</p>
                  <ul className="list-disc list-inside text-xs mt-2 space-y-1 text-slate-700">
                    {leaves.map(l => {
                      if (l.not_scheduled) {
                        return (
                          <li key={l.leave_id} className="text-slate-500 italic">
                            {l.driver_name} <span className="text-2xs">(Có lịch nghỉ nhưng hôm nay không được phân công tuyến này)</span>
                          </li>
                        );
                      } else if (l.replaced_by) {
                        return (
                          <li key={l.leave_id} className="text-green-700 font-medium">
                            <span className="font-bold line-through text-slate-400 mr-2">{l.driver_name}</span>
                            đã được thay thế bởi <span className="font-bold">{l.replaced_by}</span>
                          </li>
                        );
                      } else if (l.cleared) {
                        return (
                          <li key={l.leave_id} className="text-amber-600 font-bold">
                            {l.driver_name} <span className="font-normal">(Đã gỡ phân công, đang chờ thay thế tài xế dự bị)</span>
                          </li>
                        );
                      } else {
                        return (
                          <li key={l.leave_id} className="text-red-600 font-bold">
                            {l.driver_name} <span className="font-normal text-red-500">(Đang được phân công chạy. Cần Điều phối viên thay thế!)</span>
                          </li>
                        );
                      }
                    })}
                  </ul>
                </div>
              )}

              {planDetail.incidents && planDetail.incidents.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
                  <h4 className="font-bold text-red-800 text-xs uppercase tracking-wider mb-1.5">Sự cố trong ngày</h4>
                  <ul className="list-disc list-inside text-xs space-y-1 text-slate-700">
                    {planDetail.incidents.map(i => (
                      <li key={i.incident_id} className="text-red-700 font-medium">
                        <span className="font-bold">Xe {i.license_plate || i.bus_id}</span> ({i.incident_type === 'bus_broken' ? 'Hỏng xe' : i.incident_type}) 
                        do tài xế <span className="font-semibold">{i.reported_by_name}</span> báo cáo lúc {
                          (() => {
                            const d = new Date(i.created_at);
                            d.setHours(d.getHours() + 7);
                            return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                          })()
                        }.
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Outbound & Inbound Tables Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderTripTable(outboundTrips, `Chiều Đi (Từ ${outboundTrips[0]?.start_point || 'A'})`)}
                {renderTripTable(inboundTrips, `Chiều Về (Từ ${inboundTrips[0]?.start_point || 'B'})`)}
              </div>

              {/* Standby Drivers */}
              {planDetail.standby_drivers && planDetail.standby_drivers.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="bg-amber-50 border-b border-amber-100 p-4 font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <span>Tài xế Dự bị (Hôm nay)</span>
                    <span className="bg-amber-200 text-amber-800 text-xs px-2 py-0.5 rounded-full">
                      {planDetail.standby_drivers.length}
                    </span>
                  </div>
                  <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {planDetail.standby_drivers.map(sd => (
                      <div
                        key={sd.assignment_id}
                        className={`border rounded-xl p-3 flex flex-col gap-1 transition cursor-pointer ${highlightedDriver === sd.driver_name
                            ? 'bg-yellow-100 border-yellow-300 shadow-sm'
                            : 'border-amber-100 bg-amber-50/50 hover:bg-amber-100'
                          }`}
                        onClick={() => setHighlightedDriver(sd.driver_name === highlightedDriver ? null : sd.driver_name)}
                      >
                        <div className="font-bold text-slate-800 text-xs">{sd.driver_name}</div>
                        <div className="text-[10px] text-slate-500">Ca: {sd.assignment_type === 'standby_morning' ? 'Sáng (đến 13h)' : 'Chiều (từ 13h)'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                Duyệt kế hoạch
              </label>
              <label className="flex items-center gap-2 font-semibold text-sm text-slate-700 cursor-pointer">
                <input type="radio" name="decision" value="reject" checked={reviewDecision === 'reject'} onChange={() => setReviewDecision('reject')} className="w-4 h-4 text-red-600" />
                Từ chối
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
              className={`px-5 py-2.5 text-white rounded-xl text-sm font-semibold shadow-md transition ${reviewDecision === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
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
