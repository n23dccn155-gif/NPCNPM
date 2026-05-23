// pages/dispatcher/AffectedTrips.jsx — Chuyến bị ảnh hưởng (do xe hỏng hoặc tài xế nghỉ)
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox, Modal } from '../../components/UI';
import { getAllIncidents, getIncidentAffectedTrips } from '../../services/miscService';
import { getAffectedTrips as getLeaveAffectedTrips, getAllLeaves } from '../../services/leaveService';
import { getBuses } from '../../services/busService';
import { replaceAssignment } from '../../services/tripService';

export default function AffectedTrips() {
  const [tab, setTab] = useState('incidents');
  const [incidents, setIncidents] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [affectedTrips, setAffectedTrips] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [buses, setBuses] = useState([]);
  const [selectedBus, setSelectedBus] = useState('');
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAllIncidents({ status: 'pending' }).catch(() => ({ data: { data: [] } })),
      getAllLeaves({ status: 'approved' }).catch(() => ({ data: { data: [] } })),
      getBuses({ status: 'active' }).catch(() => ({ data: { data: [] } })),
    ]).then(([inc, lv, bus]) => {
      setIncidents(inc.data?.data || []);
      setLeaves(lv.data?.data || []);
      setBuses(bus.data?.data || []);
      setLoading(false);
    });
  }, []);

  const viewIncidentAffected = async (incident) => {
    setSelectedIncident(incident); setSelectedLeave(null); setAffectedTrips([]);
    try {
      const res = await getIncidentAffectedTrips(incident.id);
      setAffectedTrips(res.data?.data || []);
    } catch { setAffectedTrips([]); }
  };

  const viewLeaveAffected = async (leave) => {
    setSelectedLeave(leave); setSelectedIncident(null); setAffectedTrips([]);
    try {
      const res = await getLeaveAffectedTrips(leave.id);
      setAffectedTrips(res.data?.data || []);
    } catch { setAffectedTrips([]); }
  };

  const openReplace = (trip) => {
    setSelectedTrip(trip); setSelectedBus(''); setError(''); setShowModal(true);
  };

  const handleReplace = async () => {
    if (!selectedBus) { setError('Vui lòng chọn xe thay thế'); return; }
    setError('');
    try {
      await replaceAssignment(selectedTrip.trip_code, { bus_id: selectedBus, driver_code: selectedTrip.driver_code });
      setSuccess('Đã điều chỉnh phân công thành công!');
      setShowModal(false);
      setTimeout(() => setSuccess(''), 3000);
      // Refresh affected trips
      if (selectedIncident) await viewIncidentAffected(selectedIncident);
      else if (selectedLeave) await viewLeaveAffected(selectedLeave);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.issues?.join(', ') || 'Lỗi điều chỉnh');
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Chuyến bị ảnh hưởng"
        subtitle="Xử lý các chuyến xe bị ảnh hưởng do xe hỏng hoặc tài xế nghỉ"
      />

      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5 w-fit">
        {[{ key: 'incidents', label: '🔧 Do xe hỏng' }, { key: 'leaves', label: '📋 Do tài xế nghỉ' }].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setAffectedTrips([]); setSelectedIncident(null); setSelectedLeave(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: List of incidents or leaves */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-medium text-gray-900 text-sm">
              {tab === 'incidents' ? 'Sự cố chờ xử lý' : 'Yêu cầu nghỉ đã duyệt'}
            </h3>
          </div>
          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Đang tải...</div>
          ) : tab === 'incidents' ? (
            incidents.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Không có sự cố nào</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {incidents.map(i => (
                  <div
                    key={i.id}
                    onClick={() => viewIncidentAffected(i)}
                    className={`px-5 py-3 cursor-pointer hover:bg-slate-50 transition ${selectedIncident?.id === i.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                  >
                    <div className="font-medium text-sm text-gray-900">{i.driver_name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Xe: {i.bus_id} • {i.description?.slice(0, 40)}...
                    </div>
                    <div className="text-xs text-orange-500 mt-0.5">{new Date(i.report_time).toLocaleString('vi-VN')}</div>
                  </div>
                ))}
              </div>
            )
          ) : (
            leaves.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Không có yêu cầu nghỉ nào</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {leaves.map(l => (
                  <div
                    key={l.id}
                    onClick={() => viewLeaveAffected(l)}
                    className={`px-5 py-3 cursor-pointer hover:bg-slate-50 transition ${selectedLeave?.id === l.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                  >
                    <div className="font-medium text-sm text-gray-900">{l.driver_name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Ngày nghỉ: {l.leave_date} | {l.reason}</div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Right: Affected trips */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-medium text-gray-900 text-sm">Chuyến bị ảnh hưởng</h3>
          </div>
          {!selectedIncident && !selectedLeave ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Chọn một mục bên trái để xem chuyến bị ảnh hưởng
            </div>
          ) : affectedTrips.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Không có chuyến nào bị ảnh hưởng</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {affectedTrips.map(t => (
                <div key={t.trip_code} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm font-semibold text-gray-900">{t.trip_code}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{t.route_name || t.route_code}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {t.trip_date} | {t.scheduled_departure}
                      </div>
                      <div className="text-xs mt-1">
                        <span className="text-gray-500">Xe hiện tại: </span>
                        <span className="font-medium text-red-600">{t.bus_id || '—'}</span>
                        {t.driver_code && <span className="text-gray-500 ml-2">Tài xế: {t.driver_name || t.driver_code}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => openReplace(t)}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition flex-shrink-0"
                    >
                      Điều chỉnh
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal thay xe */}
      <Modal isOpen={showModal} title={`Điều chỉnh phân công: ${selectedTrip?.trip_code}`} onClose={() => setShowModal(false)}>
        <div className="space-y-4">
          {error && <AlertBox type="error" message={error} />}
          {selectedTrip && (
            <div className="bg-slate-50 rounded-xl p-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">Chuyến:</span> <span className="font-medium">{selectedTrip.trip_code}</span></div>
                <div><span className="text-gray-500">Ngày:</span> <span className="font-medium">{selectedTrip.trip_date}</span></div>
                <div><span className="text-gray-500">Giờ:</span> <span className="font-medium">{selectedTrip.scheduled_departure}</span></div>
                <div><span className="text-gray-500">Tài xế:</span> <span className="font-medium">{selectedTrip.driver_name || selectedTrip.driver_code || '—'}</span></div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Chọn xe thay thế *</label>
            <select
              value={selectedBus}
              onChange={e => setSelectedBus(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Chọn xe --</option>
              {buses.map(b => (
                <option key={b.bus_id} value={b.bus_id}>{b.bus_id} ({b.capacity} chỗ)</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition">Hủy</button>
            <button onClick={handleReplace} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-medium transition">Xác nhận điều chỉnh</button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
