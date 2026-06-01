import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox, Modal } from '../../components/UI';
import { getMyLeaves, createLeave } from '../../services/leaveService';

export default function LeaveRequest() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ leave_date: '', reason: '' });
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const loadLeaves = () => {
    setLoading(true);
    getMyLeaves()
      .then(res => setLeaves(res.data?.data || res.data || []))
      .catch(() => setLeaves([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadLeaves(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await createLeave(form);
      setShowModal(false);
      setSuccess('Đã gửi yêu cầu nghỉ phép thành công! Vui lòng chờ phê duyệt.');
      setTimeout(() => setSuccess(''), 4000);
      loadLeaves();
      setForm({ leave_date: '', reason: '' });
    } catch (err) {
      setFormError(err.response?.data?.message || 'Không thể gửi yêu cầu nghỉ phép.');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = {
    pending: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Bị từ chối'
  };

  const statusColor = {
    pending: 'bg-amber-50 text-amber-700 border-amber-100',
    approved: 'bg-green-50 text-green-700 border-green-100',
    rejected: 'bg-red-50 text-red-700 border-red-100'
  };

  return (
    <Layout>
      <PageHeader
        title="Đăng ký nghỉ phép"
        subtitle="Quản lý ngày nghỉ và gửi đơn xin nghỉ phép đến Quản lý vận hành"
        action={
          <button
            onClick={() => { setForm({ leave_date: '', reason: '' }); setFormError(''); setShowModal(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/10 transition"
          >
            + Gửi đơn nghỉ phép
          </button>
        }
      />

      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-bold text-gray-700">Lịch sử xin nghỉ phép của tôi</h3>
        </div>
        
        {loading ? (
          <div className="text-center py-16 text-slate-400 font-semibold animate-pulse">Đang tải lịch sử...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Ngày nghỉ', 'Lý do chi tiết', 'Trạng thái'].map(h => (
                    <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-gray-400">
                      Bạn chưa gửi đơn xin nghỉ phép nào
                    </td>
                  </tr>
                ) : (
                  leaves.map(l => (
                    <tr key={l.leave_id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {new Date(l.leave_date).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={l.reason}>
                        {l.reason || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-bold border ${statusColor[l.status]}`}>
                          {statusLabel[l.status] || l.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} title="Đơn xin nghỉ phép mới" onClose={() => setShowModal(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Ngày nghỉ *</label>
            <input
              type="date"
              value={form.leave_date}
              onChange={e => setForm({ ...form, leave_date: e.target.value })}
              required
              min={new Date().toISOString().split('T')[0]}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Lý do nghỉ *</label>
            <textarea
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              required
              rows={4}
              placeholder="Nhập lý do chi tiết (VD: Khám bệnh định kỳ, việc gia đình...)"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 justify-end pt-3 border-t">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/10 transition"
            >
              {saving ? 'Đang gửi...' : 'Gửi đơn nghỉ phép'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
