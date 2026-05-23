// pages/manager/Reports.jsx — Báo cáo (cải tiến với 3 loại theo Figma)
import { useState } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox } from '../../components/UI';
import { getRouteReport, getBusReport, getDriverReport } from '../../services/miscService';

const TABS = [
  { key: 'routes', label: 'Báo cáo hiệu suất tuyến' },
  { key: 'buses', label: 'Báo cáo sử dụng xe' },
  { key: 'drivers', label: 'Báo cáo năng suất tài xế' },
];

const COLS = {
  routes: [
    { key: 'route_code', label: 'Tuyến' },
    { key: 'route_name', label: 'Tên tuyến' },
    { key: 'total_trips', label: 'Chuyến KH' },
    { key: 'executed_trips', label: 'Thực hiện' },
    { key: 'on_time_trips', label: 'Đúng giờ', color: '#16a34a' },
    { key: 'delayed_trips', label: 'Trễ giờ', color: '#dc2626' },
    { key: 'cancelled_trips', label: 'Hủy', color: '#dc2626' },
    { key: 'on_time_rate', label: 'Tỷ lệ đúng giờ', format: 'pct' },
  ],
  buses: [
    { key: 'bus_id', label: 'Xe' },
    { key: 'bus_id', label: 'Biển số' },
    { key: 'total_assignments', label: 'Chuyến đã chạy' },
    { key: 'cancelled_trips', label: 'Chuyến hủy do xe', color: '#dc2626' },
    { key: 'status', label: 'Trạng thái' },
  ],
  drivers: [
    { key: 'driver_code', label: 'Mã' },
    { key: 'full_name', label: 'Họ tên' },
    { key: 'total_assignments', label: 'Lần phân công' },
    { key: 'executed_trips', label: 'Đã thực hiện' },
    { key: 'delayed_trips', label: 'Lần trễ', color: '#dc2626' },
    { key: 'leave_days', label: 'Ngày nghỉ' },
    { key: 'status', label: 'Trạng thái' },
  ],
};

export default function Reports() {
  const [tab, setTab] = useState('routes');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ from_date: '', to_date: '' });
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      let res;
      if (tab === 'routes') res = await getRouteReport(filters);
      else if (tab === 'buses') res = await getBusReport(filters);
      else res = await getDriverReport(filters);
      setData(res.data?.data || []);
      setHasLoaded(true);
    } catch { setError('Không thể tải báo cáo'); }
    finally { setLoading(false); }
  };

  const handleTabChange = (key) => {
    setTab(key); setData([]); setHasLoaded(false); setError('');
  };

  const cols = COLS[tab];

  const formatVal = (row, col) => {
    const val = row[col.key];
    if (val === null || val === undefined) return '—';
    if (col.format === 'pct') return typeof val === 'number' ? `${(val * 100).toFixed(1)}%` : val;
    return String(val);
  };

  const getColor = (col, val) => {
    if (!col.color) return 'text-gray-700';
    const num = Number(val);
    if (isNaN(num) || num === 0) return 'text-gray-700';
    return col.color === '#16a34a' ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold';
  };

  const busStatusLabel = { active: 'Hoạt động', broken: 'Hỏng', inactive: 'Ngưng' };
  const busStatusColor = { active: '#16a34a', broken: '#dc2626', inactive: '#64748b' };
  const driverStatusLabel = { working: 'Đang làm', on_leave: 'Nghỉ phép', inactive: 'Ngưng' };

  return (
    <Layout>
      <PageHeader title="Báo cáo thống kê" subtitle="Theo dõi hiệu quả hoạt động của hệ thống" />

      {/* Tabs — matching Figma */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-5">
        <div className="flex border-b border-slate-100">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`px-5 py-3.5 text-sm font-medium transition border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="p-4 flex flex-wrap gap-3 items-center border-b border-slate-100">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Từ ngày:</label>
            <input
              type="date"
              value={filters.from_date}
              onChange={e => setFilters({ ...filters, from_date: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Đến ngày:</label>
            <input
              type="date"
              value={filters.to_date}
              onChange={e => setFilters({ ...filters, to_date: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={load}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Xem báo cáo
          </button>
        </div>

        {/* Table */}
        {error && <div className="p-4"><AlertBox type="error" message={error} /></div>}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Đang tải báo cáo...</div>
        ) : data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  {cols.map(c => (
                    <th key={c.key + c.label} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    {cols.map(c => {
                      const raw = row[c.key];
                      const val = formatVal(row, c);
                      if (c.key === 'status' && tab === 'buses') {
                        return (
                          <td key={c.key + c.label} className="px-5 py-4 text-sm">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ background: (busStatusColor[raw] || '#64748b') + '20', color: busStatusColor[raw] || '#64748b' }}
                            >
                              {busStatusLabel[raw] || raw || '—'}
                            </span>
                          </td>
                        );
                      }
                      if (c.key === 'on_time_rate') {
                        const pct = typeof raw === 'number' ? (raw * 100).toFixed(1) : null;
                        return (
                          <td key={c.key} className="px-5 py-4 text-sm">
                            {pct !== null ? (
                              <span className={`font-semibold ${parseFloat(pct) >= 80 ? 'text-green-600' : 'text-red-600'}`}>{pct}%</span>
                            ) : '—'}
                          </td>
                        );
                      }
                      return (
                        <td key={c.key + c.label} className={`px-5 py-4 text-sm ${getColor(c, raw)}`}>{val}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : hasLoaded ? (
          <div className="text-center py-16 text-gray-400 text-sm">Không có dữ liệu báo cáo</div>
        ) : (
          <div className="text-center py-16 text-gray-400 text-sm">
            Chọn khoảng thời gian và nhấn <strong>"Xem báo cáo"</strong> để tải dữ liệu
          </div>
        )}
      </div>
    </Layout>
  );
}
