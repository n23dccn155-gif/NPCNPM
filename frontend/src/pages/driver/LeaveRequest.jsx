// pages/driver/LeaveRequest.jsx — Gửi và xem yêu cầu nghỉ (matching Figma leave-request)
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, AlertBox, Modal } from '../../components/UI';
import { getMyLeaves, createLeave } from '../../services/leaveService';

const shiftLabel = { morning: 'Ca sáng', afternoon: 'Ca chiều', full_day: 'Cả ngày' };

export default function LeaveRequest() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ leave_date: '', shift_type: 'full_day', reason: '' });
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    getMyLeaves()
      .then(res => setLeaves(res.data?.data || []))
      .catch(() => setLeaves([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    try {
      await createLeave(form);
      setShowModal(false);
      setSuccess('Đã gửi yêu cầu nghỉ phép thành công!');
      setTimeout(() => setSuccess(''), 4000);
      load();
      setForm({ leave_date: '', shift_type: 'full_day', reason: '' });
    } catch (err) {
      setFormError(err.response?.data?.message || 'Không thể gửi yêu cầu');
    } finally { setSaving(false); }
  };

  const statusColor = { pending: '#d97706', approved: '#16a34a', rejected: '#dc2626' };
  const statusLabel2 = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' };

  return (
    <Layout>
      <PageHeader
        title="Gửi yêu cầu nghỉ phép"
        subtitle="Đăng ký nghỉ phép với quản lý"
        action={
          <button
            onClick={() => { setForm({ leave_date: '', shift: 'full_day', reason: '' }); setFormError(''); setShowModal(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Gửi yêu cầu nghỉ
          </button>
        }
      />

      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-medium text-gray-700">Lịch sử yêu cầu nghỉ của tôi</h3>
        </div>
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Đang tải...</div>
        ) : leaves.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">Bạn chưa có yêu cầu nghỉ nào</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-100">
              <tr>
                {['Ngày xin nghỉ', 'Ca nghỉ', 'Lý do', 'Ngày gửi', 'Trạng thái'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leaves.map(l => (
                <tr key={l.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{l.leave_date}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{shiftLabel[l.shift_type] || l.shift_type || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                    <span className="line-clamp-1">{l.reason || '—'}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(l.created_at).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: (statusColor[l.status] || '#64748b') + '15',
                        color: statusColor[l.status] || '#64748b',
                      }}
                    >
                      {statusLabel2[l.status] || l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal gửi yêu cầu — matching Figma leave-request */}
      <Modal isOpen={showModal} title="Gửi yêu cầu nghỉ phép" onClose={() => setShowModal(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ngày xin nghỉ *</label>
              <input
                type="date"
                value={form.leave_date}
                onChange={e => setForm({ ...form, leave_date: e.target.value })}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ca nghỉ *</label>
              <select
                value={form.shift_type}
                onChange={e => setForm({ ...form, shift_type: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="full_day">Cả ngày</option>
                <option value="morning">Ca sáng</option>
                <option value="afternoon">Ca chiều</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Lý do *</label>
            <textarea
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              required
              rows={4}
              placeholder="Nhập lý do xin nghỉ..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Hủy
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl py-2.5 text-sm font-medium transition flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9 22,2"/>
              </svg>
              {saving ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
