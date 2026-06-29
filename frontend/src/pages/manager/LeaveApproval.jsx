import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { formatDate } from '../../utils/format';
import { PageHeader, AlertBox } from '../../components/UI';
import { getAllLeaves, reviewLeave, getAffectedGroups } from '../../services/leaveService';
import { SocketContext } from '../../context/SocketContext';
import { useContext } from 'react';

export default function LeaveApproval() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [confirm, setConfirm] = useState({ open: false, id: null, action: '', driverName: '' });
  const [affected, setAffected] = useState({ open: false, groups: [], requestId: null });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const { socket } = useContext(SocketContext);

  const load = () => {
    const params = filter ? { status: filter } : {};
    getAllLeaves(params)
      .then(res => setLeaves(res.data?.data || res.data || []))
      .catch(() => setLeaves([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); load(); }, [filter]);

  useEffect(() => {
    if (!socket) return;
    const handleNotif = (data) => {
      if (data?.title === 'Yêu cầu nghỉ phép mới') {
        load();
      }
    };
    socket.on('NEW_NOTIFICATION', handleNotif);
    return () => {
      socket.off('NEW_NOTIFICATION', handleNotif);
    };
  }, [socket, filter]); // filter included so load() uses the latest filter

  const handleReview = async () => {
    try {
      await reviewLeave(confirm.id, confirm.action);
      setConfirm({ open: false, id: null, action: '', driverName: '' });
      setSuccess(confirm.action === 'approved' ? 'Đã duyệt yêu cầu nghỉ phép thành công.' : 'Đã từ chối yêu cầu nghỉ phép.');
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi xử lý');
      setTimeout(() => setError(''), 3000);
    }
  };

  const viewAffected = async (leave) => {
    try {
      const res = await getAffectedGroups(leave.leave_id);
      setAffected({ open: true, groups: res.data?.data || res.data || [], requestId: leave.leave_id });
    } catch {
      setAffected({ open: true, groups: [], requestId: leave.leave_id });
    }
  };

  const statusColor = { pending: '#d97706', approved: '#16a34a', rejected: '#dc2626' };
  const statusBg = { pending: '#fef3c7', approved: '#dcfce7', rejected: '#fee2e2' };
  const statusLabel = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' };

  return (
    <Layout>
      <PageHeader
        title="Duyệt yêu cầu nghỉ phép"
        subtitle="Xem xét và phê duyệt yêu cầu xin nghỉ phép của tài xế"
        action={
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="border border-slate-200 bg-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          >
            <option value="">Tất cả trạng thái</option>
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
          <div className="text-center py-16 text-gray-400 font-semibold animate-pulse">Đang tải danh sách...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Mã đơn', 'Tài xế', 'Ngày nghỉ', 'Lý do xin nghỉ', 'Trạng thái', 'Thao tác'].map(h => (
                    <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                      Không có yêu cầu nghỉ phép nào
                    </td>
                  </tr>
                ) : (
                  leaves.map(l => (
                    <tr key={l.leave_id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-mono font-semibold text-slate-500">#LR-{l.leave_id}</td>
                      <td className="px-6 py-4 text-gray-900 font-bold">{l.driver_name}</td>
                      <td className="px-6 py-4 text-gray-700 font-semibold">
                        {formatDate(l.leave_date)}
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{l.reason || '—'}</td>
                      <td className="px-6 py-4">
                        <div>
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: statusBg[l.status], color: statusColor[l.status] }}
                          >
                            {statusLabel[l.status] || l.status}
                          </span>
                          {l.status === 'approved' && (
                            <button
                              onClick={() => viewAffected(l)}
                              className="block text-xs text-amber-600 hover:text-amber-800 font-semibold mt-1 hover:underline text-left"
                            >
                              ⚠️ Nhấp để xem các nhóm chuyến bị ảnh hưởng
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        <div className="flex gap-2">
                          {l.status === 'pending' && (
                            <>
                              <button
                                onClick={() => setConfirm({ open: true, id: l.leave_id, action: 'approved', driverName: l.driver_name })}
                                className="bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1"
                              >
                                Duyệt nghỉ
                              </button>
                              <button
                                onClick={() => setConfirm({ open: true, id: l.leave_id, action: 'rejected', driverName: l.driver_name })}
                                className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1"
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {l.status === 'approved' && (
                            <button
                              onClick={() => viewAffected(l)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-xl font-semibold transition"
                            >
                              Chuyến bị ảnh hưởng
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {confirm.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {confirm.action === 'approved' ? 'Phê duyệt nghỉ phép?' : 'Từ chối nghỉ phép?'}
            </h3>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              Bạn có chắc chắn muốn <strong>{confirm.action === 'approved' ? 'phê duyệt' : 'từ chối'}</strong> yêu cầu nghỉ phép của tài xế <strong>{confirm.driverName}</strong>?
              {confirm.action === 'approved' && (
                <span className="block mt-2 text-amber-600 font-semibold">Các nhóm chuyến phân công cho tài xế này trong ngày đó sẽ bị trống tài xế và cần điều phối viên phân công lại.</span>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirm({ open: false, id: null, action: '', driverName: '' })}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold rounded-xl transition"
              >
                Hủy
              </button>
              <button
                onClick={handleReview}
                className={`px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition ${confirm.action === 'approved' ? 'bg-green-600 hover:bg-green-700 shadow-md shadow-green-500/10' : 'bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/10'}`}
              >
                {confirm.action === 'approved' ? 'Duyệt' : 'Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Affected groups modal */}
      {affected.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAffected({ open: false, groups: [], requestId: null })}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-900">Các nhóm chuyến bị ảnh hưởng</h3>
              <button onClick={() => setAffected({ open: false, groups: [], requestId: null })} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            {affected.groups.length === 0 ? (
              <div className="text-center py-8 text-slate-400 font-medium">Không có nhóm chuyến nào bị ảnh hưởng do quyết định này</div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {affected.groups.map(g => (
                  <div key={g.group_id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-amber-900">{g.group_name}</div>
                        <div className="text-xs text-amber-700 mt-1 font-semibold">Tuyến: {g.route_code} | Xe: {g.license_plate}</div>
                        <div className="text-xs text-amber-600 mt-0.5">
                          Thời gian: {new Date(g.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(g.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">Trống tài xế</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
              <button
                onClick={() => setAffected({ open: false, groups: [], requestId: null })}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
