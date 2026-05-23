// pages/manager/LeaveApproval.jsx — Duyệt nghỉ (cải tiến theo Figma leave-approval)
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox } from '../../components/UI';
import { getAllLeaves, reviewLeave, getAffectedTrips } from '../../services/leaveService';

export default function LeaveApproval() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [confirm, setConfirm] = useState({ open: false, id: null, action: '', driverName: '' });
  const [affected, setAffected] = useState({ open: false, trips: [], requestId: null });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    const params = filter ? { status: filter } : {};
    getAllLeaves(params)
      .then(res => setLeaves(res.data?.data || []))
      .catch(() => setLeaves([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); load(); }, [filter]);

  const handleReview = async () => {
    try {
      await reviewLeave(confirm.id, confirm.action);
      setConfirm({ open: false, id: null, action: '', driverName: '' });
      setSuccess(confirm.action === 'approved' ? 'Đã duyệt yêu cầu nghỉ phép.' : 'Đã từ chối yêu cầu nghỉ phép.');
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi xử lý'); setTimeout(() => setError(''), 3000);
    }
  };

  const viewAffected = async (leave) => {
    try {
      const res = await getAffectedTrips(leave.id);
      setAffected({ open: true, trips: res.data?.data || [], requestId: leave.id });
    } catch { setAffected({ open: true, trips: [], requestId: leave.id }); }
  };

  const statusColor = { pending: '#d97706', approved: '#16a34a', rejected: '#dc2626' };
  const statusBg = { pending: '#fef3c7', approved: '#dcfce7', rejected: '#fee2e2' };
  const statusLabel = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' };
  const shiftLabel = { morning: 'Ca sáng', afternoon: 'Ca chiều', full_day: 'Cả ngày' };

  return (
    <Layout>
      <PageHeader
        title="Duyệt yêu cầu nghỉ phép"
        subtitle="Xem xét và phê duyệt yêu cầu nghỉ phép của tài xế"
        action={
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
        }
      />

      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}
      {error && <div className="mb-4"><AlertBox type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Đang tải...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Mã YC', 'Tài xế', 'Ngày nghỉ', 'Ca nghỉ', 'Lý do', 'Trạng thái', 'Thao tác'].map(h => (
                  <th key={h} className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase ${h === 'Thao tác' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leaves.map(l => (
                <tr key={l.id} className="hover:bg-slate-50 transition">
                  <td className="px-5 py-4 font-mono text-sm font-medium text-gray-700">LR{String(l.id).padStart(3, '0')}</td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-900">{l.driver_name}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">{l.leave_date}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{shiftLabel[l.shift_type] || l.shift_type || 'Cả ngày'}</td>
                  <td className="px-5 py-4 text-sm text-gray-600 max-w-xs">
                    <span className="line-clamp-1">{l.reason || '—'}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div>
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: statusBg[l.status], color: statusColor[l.status] }}
                      >
                        {statusLabel[l.status] || l.status}
                      </span>
                      {l.status === 'approved' && (
                        <div className="text-xs text-amber-600 mt-0.5 cursor-pointer hover:underline" onClick={() => viewAffected(l)}>
                          ⚠️ Có chuyến bị ảnh hưởng
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      {l.status === 'pending' && (
                        <>
                          <button
                            onClick={() => setConfirm({ open: true, id: l.id, action: 'approved', driverName: l.driver_name })}
                            className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>
                            Duyệt
                          </button>
                          <button
                            onClick={() => setConfirm({ open: true, id: l.id, action: 'rejected', driverName: l.driver_name })}
                            className="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            Từ chối
                          </button>
                        </>
                      )}
                      {l.status === 'approved' && (
                        <button
                          onClick={() => viewAffected(l)}
                          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg font-medium transition"
                        >
                          Xem chuyến bị ảnh hưởng
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && leaves.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">Không có yêu cầu nghỉ nào</div>
        )}
      </div>

      {/* Confirm dialog */}
      {confirm.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {confirm.action === 'approved' ? '✅ Duyệt yêu cầu nghỉ?' : '❌ Từ chối yêu cầu nghỉ?'}
            </h3>
            <p className="text-gray-600 text-sm mb-6">
              Bạn có chắc muốn <strong>{confirm.action === 'approved' ? 'duyệt' : 'từ chối'}</strong> yêu cầu nghỉ của tài xế <strong>{confirm.driverName}</strong>?
              {confirm.action === 'approved' && (
                <span className="block mt-2 text-amber-600 text-xs">⚠️ Các chuyến của tài xế này trong ngày nghỉ sẽ cần được điều chỉnh.</span>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirm({ open: false, id: null, action: '', driverName: '' })}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition"
              >
                Hủy
              </button>
              <button
                onClick={handleReview}
                className={`px-4 py-2 rounded-xl text-white text-sm font-medium transition ${confirm.action === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {confirm.action === 'approved' ? 'Duyệt' : 'Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Affected trips */}
      {affected.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAffected({ open: false, trips: [], requestId: null })}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-gray-900">Chuyến bị ảnh hưởng</h3>
              <button onClick={() => setAffected({ open: false, trips: [], requestId: null })} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {affected.trips.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Không có chuyến nào bị ảnh hưởng</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {affected.trips.map(t => (
                  <div key={t.trip_code} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-sm font-semibold text-amber-800">Chuyến {t.trip_code}</span>
                        <div className="text-xs text-amber-600 mt-0.5">{t.trip_date} | {t.scheduled_departure}</div>
                        <div className="text-xs text-amber-600">{t.route_name || t.route_code}</div>
                      </div>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-medium">Cần điều chỉnh</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setAffected({ open: false, trips: [], requestId: null })} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">Đóng</button>
              <a href="/dispatcher/affected-trips" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition">Đi đến trang điều chỉnh</a>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
