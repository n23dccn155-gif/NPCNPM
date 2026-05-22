// pages/manager/LeaveApproval.jsx — Duyệt nghỉ
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, ConfirmDialog, AlertBox } from '../../components/UI';
import { getAllLeaves, reviewLeave } from '../../services/leaveService';

export default function LeaveApproval() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [confirm, setConfirm] = useState({ open: false, id: null, action: '' });
  const [success, setSuccess] = useState('');

  const load = () => getAllLeaves({ status: filter || undefined }).then(res => setLeaves(res.data.data)).finally(() => setLoading(false));
  useEffect(() => { setLoading(true); load(); }, [filter]);

  const handleReview = async () => {
    try {
      await reviewLeave(confirm.id, confirm.action);
      setConfirm({ open: false, id: null, action: '' });
      setSuccess(confirm.action === 'approved' ? 'Đã duyệt yêu cầu nghỉ.' : 'Đã từ chối yêu cầu nghỉ.');
      load(); setTimeout(() => setSuccess(''), 3000);
    } catch (err) { alert(err.response?.data?.message || 'Lỗi'); }
  };

  return (
    <Layout>
      <PageHeader title="Duyệt nghỉ phép" subtitle="Xem xét và phê duyệt yêu cầu nghỉ của tài xế"
        action={
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Đã từ chối</option>
            <option value="">Tất cả</option>
          </select>
        }
      />
      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Tài xế', 'Ngày nghỉ', 'Lý do', 'Trạng thái', 'Ngày gửi', 'Thao tác'].map(h => (
                <th key={h} className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${h === 'Thao tác' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leaves.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{l.driver_name} <span className="text-xs text-gray-400">({l.driver_code})</span></td>
                <td className="px-6 py-4 text-sm font-medium">{l.leave_date}</td>
                <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{l.reason || '—'}</td>
                <td className="px-6 py-4"><StatusBadge status={l.status} /></td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(l.created_at).toLocaleDateString('vi-VN')}</td>
                <td className="px-6 py-4 text-right space-x-2">
                  {l.status === 'pending' && (
                    <>
                      <button onClick={() => setConfirm({ open: true, id: l.id, action: 'approved' })}
                        className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium">Duyệt</button>
                      <button onClick={() => setConfirm({ open: true, id: l.id, action: 'rejected' })}
                        className="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-medium">Từ chối</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && leaves.length === 0 && <div className="text-center py-16 text-gray-400">Không có yêu cầu nghỉ nào</div>}
      </div>
      <ConfirmDialog isOpen={confirm.open}
        title={confirm.action === 'approved' ? 'Duyệt yêu cầu nghỉ?' : 'Từ chối yêu cầu nghỉ?'}
        message={`Bạn có chắc muốn ${confirm.action === 'approved' ? 'duyệt' : 'từ chối'} yêu cầu này không?`}
        onConfirm={handleReview} onCancel={() => setConfirm({ open: false, id: null, action: '' })}
        confirmText={confirm.action === 'approved' ? 'Duyệt' : 'Từ chối'} danger={confirm.action === 'rejected'} />
    </Layout>
  );
}
