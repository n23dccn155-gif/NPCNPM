import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { formatDate } from '../../utils/format';
import { PageHeader, AlertBox, Modal } from '../../components/UI';
import { getAllIncidents, updateIncidentStatus, getAffectedGroups as getIncidentAffected } from '../../services/incidentService';
import { getAllLeaves, getAffectedGroups as getLeaveAffected } from '../../services/leaveService';
import { getAvailableResources, replaceDriver, replaceBus } from '../../services/assignmentService';

export default function AffectedTrips() {
  const [tab, setTab] = useState('incidents');
  const [incidents, setIncidents] = useState([]);
  const [leaves, setLeaves] = useState([]);
  
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [affectedGroups, setAffectedGroups] = useState([]);
  
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [availableResources, setAvailableResources] = useState({ buses: [], drivers: [] });
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [replaceForm, setReplaceForm] = useState({ bus_id: '', driver_id: '' });
  
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [incRes, leaveRes] = await Promise.all([
        getAllIncidents().catch(() => ({ data: [] })),
        getAllLeaves({ status: 'approved' }).catch(() => ({ data: [] })),
      ]);
      setIncidents(incRes.data?.data || incRes.data || []);
      setLeaves(leaveRes.data?.data || leaveRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const viewIncidentAffected = async (incident) => {
    setSelectedIncident(incident);
    setSelectedLeave(null);
    setAffectedGroups([]);
    try {
      const res = await getIncidentAffected(incident.incident_id);
      setAffectedGroups(res.data?.data || res.data || []);
    } catch (err) {
      console.error(err);
      setAffectedGroups([]);
    }
  };

  const viewLeaveAffected = async (leave) => {
    setSelectedLeave(leave);
    setSelectedIncident(null);
    setAffectedGroups([]);
    try {
      const res = await getLeaveAffected(leave.leave_id);
      setAffectedGroups(res.data?.data || res.data || []);
    } catch (err) {
      console.error(err);
      setAffectedGroups([]);
    }
  };

  const openReplace = async (group) => {
    setSelectedGroup(group);
    setReplaceForm({
      bus_id: group.bus_id ? String(group.bus_id) : '',
      driver_id: group.driver_id ? String(group.driver_id) : ''
    });
    setError('');
    setShowReplaceModal(true);
    setResourcesLoading(true);
    try {
      const res = await getAvailableResources(group.group_id, true);
      setAvailableResources(res.data?.data || res.data || { buses: [], drivers: [] });
    } catch (err) {
      console.error(err);
    } finally {
      setResourcesLoading(false);
    }
  };

  const handleReplaceSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // If driver changed
      if (replaceForm.driver_id && Number(replaceForm.driver_id) !== selectedGroup.driver_id) {
        await replaceDriver({ group_id: selectedGroup.group_id, new_driver_id: Number(replaceForm.driver_id) });
      }
      // If bus changed
      if (replaceForm.bus_id && Number(replaceForm.bus_id) !== selectedGroup.bus_id) {
        await replaceBus({ group_id: selectedGroup.group_id, new_bus_id: Number(replaceForm.bus_id) });
      }

      setSuccess('Đã cập nhật phân công tài nguyên thay thế thành công.');
      setShowReplaceModal(false);
      setTimeout(() => setSuccess(''), 4000);
      
      // Refresh current affected view
      if (selectedIncident) viewIncidentAffected(selectedIncident);
      if (selectedLeave) viewLeaveAffected(selectedLeave);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi thay thế tài nguyên');
    }
  };

  const handleResolveIncident = async (incidentId) => {
    try {
      await updateIncidentStatus(incidentId, 'resolved');
      setSuccess('Đã cập nhật sự cố thành TRẠNG THÁI ĐÃ XỬ LÝ.');
      setTimeout(() => setSuccess(''), 4000);
      setSelectedIncident(null);
      setAffectedGroups([]);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Không thể cập nhật trạng thái sự cố');
    }
  };

  const handleProcessIncident = async (incidentId) => {
    try {
      await updateIncidentStatus(incidentId, 'processing');
      setSuccess('Đã chuyển sự cố sang trạng thái ĐANG XỬ LÝ.');
      setTimeout(() => setSuccess(''), 4000);
      loadData();
      // reload details
      const found = incidents.find(i => i.incident_id === incidentId);
      if (found) viewIncidentAffected({ ...found, status: 'processing' });
    } catch (err) {
      console.error(err);
    }
  };

  const incidentTypes = {
    bus_broken: 'Hỏng xe',
    delay: 'Trễ chuyến',
    cancelled: 'Hủy chuyến',
    other: 'Khác'
  };

  const incidentStatusLabel = {
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    resolved: 'Đã giải quyết'
  };

  const incidentStatusColor = {
    pending: 'bg-red-50 text-red-700 border-red-100',
    processing: 'bg-amber-50 text-amber-700 border-amber-100',
    resolved: 'bg-green-50 text-green-700 border-green-100'
  };

  return (
    <Layout>
      <PageHeader
        title="Điều phối sự cố & Nghỉ phép khẩn cấp"
        subtitle="Giải quyết các nhóm chuyến bị trống tài xế hoặc xe do tài xế xin nghỉ hoặc gặp sự cố trên đường chạy"
      />

      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-100 pb-3">
        <button
          onClick={() => { setTab('incidents'); setAffectedGroups([]); setSelectedIncident(null); setSelectedLeave(null); }}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
            tab === 'incidents' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          🔧 Báo cáo sự cố từ tài xế
        </button>
        <button
          onClick={() => { setTab('leaves'); setAffectedGroups([]); setSelectedIncident(null); setSelectedLeave(null); }}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
            tab === 'leaves' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          📋 Chuyến ảnh hưởng do tài xế nghỉ phép
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: List items */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 text-sm mb-4">
              {tab === 'incidents' ? 'Danh sách báo cáo sự cố' : 'Đơn xin nghỉ phép đã duyệt'}
            </h3>

            {loading ? (
              <div className="text-center py-10 text-slate-400 font-semibold animate-pulse">Đang tải...</div>
            ) : tab === 'incidents' ? (
              incidents.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">Không có sự cố nào trong hệ thống</div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {incidents.map(i => (
                    <div
                      key={i.incident_id}
                      onClick={() => viewIncidentAffected(i)}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition ${
                        selectedIncident?.incident_id === i.incident_id
                          ? 'border-blue-500 bg-blue-50/20'
                          : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-800 text-xs">{i.driver_name}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-3xs font-bold border ${incidentStatusColor[i.status]}`}>
                          {incidentStatusLabel[i.status] || i.status}
                        </span>
                      </div>
                      <div className="text-2xs font-bold text-red-600 mt-1">
                        Loại: {incidentTypes[i.incident_type] || i.incident_type} • Xe: {i.license_plate || 'Chưa rõ'}
                      </div>
                      <p className="text-xs text-gray-600 mt-2 line-clamp-2 italic">
                        "{i.description}"
                      </p>
                    </div>
                  ))}
                </div>
              )
            ) : (
              leaves.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">Không có yêu cầu nghỉ phép được duyệt</div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {leaves.map(l => (
                    <div
                      key={l.leave_id}
                      onClick={() => viewLeaveAffected(l)}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition ${
                        selectedLeave?.leave_id === l.leave_id
                          ? 'border-blue-500 bg-blue-50/20'
                          : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="font-bold text-slate-800 text-xs">{l.driver_name}</div>
                      <div className="text-2xs font-semibold text-slate-500 mt-1">
                        Ngày xin nghỉ: {formatDate(l.leave_date)}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-1">Lý do: {l.reason || '—'}</p>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Right column: Affected groups and actions */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm min-h-[300px] flex flex-col">
            <h3 className="font-bold text-gray-900 text-sm mb-4">Các nhóm chuyến bị ảnh hưởng trực tiếp</h3>

            {!selectedIncident && !selectedLeave ? (
              <div className="flex-1 flex flex-col justify-center items-center text-slate-400 text-xs py-20">
                <span>Chọn sự cố hoặc đơn xin nghỉ phép ở bên trái để phân tích ảnh hưởng lịch trình</span>
              </div>
            ) : (
              <div className="space-y-4 flex-1 flex flex-col">
                {/* Incident Detail header / control */}
                {selectedIncident && (
                  <div className="bg-slate-50 rounded-xl p-4 text-xs font-semibold text-slate-700 flex justify-between items-center">
                    <div>
                      <div>Chi tiết sự cố: <span className="font-bold">{incidentTypes[selectedIncident.incident_type] || selectedIncident.incident_type}</span></div>
                      <div className="text-slate-500 text-2xs mt-1">Báo cáo bởi {selectedIncident.driver_name}</div>
                    </div>
                    <div className="flex gap-2">
                      {selectedIncident.status === 'pending' && (
                        <button
                          onClick={() => handleProcessIncident(selectedIncident.incident_id)}
                          className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-2xs font-bold transition"
                        >
                          Đang xử lý
                        </button>
                      )}
                      {selectedIncident.status !== 'resolved' && (
                        <button
                          onClick={() => handleResolveIncident(selectedIncident.incident_id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-2xs font-bold transition"
                        >
                          Giải quyết xong
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {selectedLeave && (
                  <div className="bg-slate-50 rounded-xl p-4 text-xs font-semibold text-slate-700">
                    Nghỉ phép tài xế: <span className="font-bold">{selectedLeave.driver_name}</span> ngày {formatDate(selectedLeave.leave_date)}
                  </div>
                )}

                {/* Affected trip groups list */}
                {affectedGroups.length === 0 ? (
                  <div className="flex-1 flex justify-center items-center text-slate-400 text-xs py-10 font-semibold bg-slate-50/50 rounded-xl">
                    ✅ Tuyệt vời! Không phát hiện nhóm chuyến nào bị ảnh hưởng hoặc tất cả đã được tái điều phối.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {affectedGroups.map(g => (
                      <div key={g.group_id} className="border border-red-100 bg-red-50/10 rounded-xl p-4 flex justify-between items-center transition">
                        <div>
                          <div className="font-bold text-red-900 text-sm">{g.group_name}</div>
                          <div className="text-xs font-semibold text-slate-600 mt-1">
                            Tuyến: {g.route_code} | Giờ chạy: {new Date(g.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(g.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-2xs text-slate-500 mt-1">
                            Xe: {g.license_plate || g.bus_id || 'Chưa phân công'} | Tài xế: {g.driver_name || g.driver_id || 'Chưa phân công'}
                          </div>
                        </div>
                        <button
                          onClick={() => openReplace(g)}
                          className="bg-red-600 hover:bg-red-700 text-white text-2xs font-bold px-3 py-2 rounded-xl transition shadow-md shadow-red-500/10"
                        >
                          Thay thế khẩn
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resource Replacement Modal */}
      <Modal isOpen={showReplaceModal} title="Phân bổ thay thế khẩn cấp" onClose={() => setShowReplaceModal(false)}>
        {resourcesLoading ? (
          <div className="text-center py-10 text-slate-400 font-semibold animate-pulse">Đang tìm tài xế & xe dự bị khả dụng...</div>
        ) : (
          <form onSubmit={handleReplaceSubmit} className="space-y-4">
            {error && <AlertBox type="error" message={error} />}

            {selectedGroup && (
              <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1">
                <div><span className="text-slate-400 font-semibold">Nhóm chuyến:</span> <span className="font-bold text-slate-800">{selectedGroup.group_name}</span></div>
                <div><span className="text-slate-400 font-semibold">Khung giờ:</span> <span className="font-bold text-slate-800">{new Date(selectedGroup.start_time).toLocaleTimeString('vi-VN')} - {new Date(selectedGroup.end_time).toLocaleTimeString('vi-VN')}</span></div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Chọn xe thay thế (Xe nhàn rỗi / Xe dự bị) *</label>
              <select
                value={replaceForm.bus_id}
                onChange={e => setReplaceForm({ ...replaceForm, bus_id: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                <option value="">-- Giữ nguyên hoặc chọn xe mới --</option>
                {availableResources.buses?.map(b => (
                  <option key={b.bus_id} value={b.bus_id}>
                    {b.license_plate} ({b.seat_count} chỗ, {b.bus_role === 'standby' ? 'Dự bị' : 'Vận doanh'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Chọn tài xế thay thế (Tài xế dự bị / rảnh ca) *</label>
              <select
                value={replaceForm.driver_id}
                onChange={e => setReplaceForm({ ...replaceForm, driver_id: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                <option value="">-- Giữ nguyên hoặc chọn tài xế mới --</option>
                {availableResources.drivers?.map(d => (
                  <option key={d.driver_id} value={d.driver_id}>
                    {d.full_name} (Hạng {d.license_class})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowReplaceModal(false)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/10 transition"
              >
                Cập nhật thay thế
              </button>
            </div>
          </form>
        )}
      </Modal>
    </Layout>
  );
}
