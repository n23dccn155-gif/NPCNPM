import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, StatusBadge, Modal, AlertBox } from '../../components/UI';
import { getMyLeaves, createLeave } from '../../services/leaveService';

export default function LeaveRequest() {
  const [leaves, setLeaves] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ leave_date: '', reason: '' });
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => getMyLeaves().then(res => setLeaves(res.data.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setFormError('');
    try {
      await createLeave(form);
      setShowModal(false); setSuccess('Yêu cầu nghỉ đã được gửi thành công!'); load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setFormError(err.response?.data?.message || 'Lỗi khi gửi yêu cầu'); }
  };

  return (
    <Layout>
      <PageHeader title="Yêu cầu nghỉ phép" subtitle="Quản lý đơn xin nghỉ của bạn"
        action={<button onClick={() => { setForm({ leave_date: '', reason: '' }); setFormError(''); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Gửi yêu cầu nghỉ</button>} />
      {success && <AlertBox type="success" message={success} />}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-4">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Ngày nghỉ', 'Lý do', 'Trạng thái', 'Ngày gửi'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leaves.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{l.leave_date}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{l.reason || '—'}</td>
                <td className="px-6 py-4"><StatusBadge status={l.status} /></td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(l.created_at).toLocaleDateString('vi-VN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {leaves.length === 0 && <div className="text-center py-16 text-gray-400">Chưa có yêu cầu nghỉ nào</div>}
      </div>
      <Modal isOpen={showModal} title="Gửi yêu cầu nghỉ" onClose={() => setShowModal(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <AlertBox type="error" message={formError} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày nghỉ *</label>
            <input type="date" value={form.leave_date} onChange={e => setForm({ ...form, leave_date: e.target.value })} required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lý do</label>
            <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={3}
              placeholder="Nhập lý do xin nghỉ (không bắt buộc)..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl text-sm text-gray-600">Hủy</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">Gửi yêu cầu</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
