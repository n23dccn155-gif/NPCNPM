import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox } from '../../components/UI';
import { getAssignments } from '../../services/assignmentService';

export default function AssignmentList() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const res = await getAssignments(params);
      setAssignments(res.data?.data || res.data || []);
    } catch (err) {
      console.error(err);
      setError('Không thể tải danh sách phân công.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterStatus]);

  const statusLabel = {
    active: 'Đang hiệu lực',
    replaced: 'Đã thay thế',
    cancelled: 'Đã hủy'
  };

  const statusColor = {
    active: 'bg-green-50 text-green-700',
    replaced: 'bg-amber-50 text-amber-700',
    cancelled: 'bg-red-50 text-red-700'
  };

  const filtered = assignments.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (a.group_name || '').toLowerCase().includes(q) ||
      (a.license_plate || '').toLowerCase().includes(q) ||
      (a.driver_name || '').toLowerCase().includes(q) ||
      (a.route_code || '').toLowerCase().includes(q)
    );
  });

  return (
    <Layout>
      <PageHeader
        title="Tra cứu phân công"
        subtitle="Xem toàn bộ lịch sử phân công xe và tài xế cho các nhóm chuyến"
      />

      {error && <div className="mb-4"><AlertBox type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tìm kiếm:</label>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nhóm chuyến, biển số, tài xế, tuyến..."
            className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái:</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả</option>
            <option value="active">Đang hiệu lực</option>
            <option value="replaced">Đã thay thế</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>
        <div className="ml-auto text-xs font-bold text-slate-400">
          Tìm thấy {filtered.length} phân công
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-400 font-semibold animate-pulse">Đang tải danh sách phân công...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['ID', 'Nhóm chuyến', 'Tuyến', 'Ngày VH', 'Xe buýt', 'Tài xế', 'Phân bởi', 'Trạng thái'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400">
                      Không tìm thấy phân công nào
                    </td>
                  </tr>
                ) : (
                  filtered.map(a => (
                    <tr key={a.assignment_id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-600">#{a.assignment_id}</td>
                      <td className="px-5 py-3.5 font-bold text-slate-800">{a.group_name || '—'}</td>
                      <td className="px-5 py-3.5 font-bold text-blue-600">{a.route_code || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">
                        {a.operation_date ? new Date(a.operation_date).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-800">{a.license_plate || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-700 font-semibold">{a.driver_name || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{a.assigned_by_name || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-bold ${statusColor[a.status] || 'bg-slate-100 text-slate-700'}`}>
                          {statusLabel[a.status] || a.status}
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
    </Layout>
  );
}
