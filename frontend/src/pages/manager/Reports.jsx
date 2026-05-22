// pages/manager/Reports.jsx — Báo cáo thống kê
import { useState } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox } from '../../components/UI';
import { getRouteReport, getBusReport, getDriverReport } from '../../services/miscService';

export default function Reports() {
  const [tab, setTab] = useState('routes');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ from_date: '', to_date: '' });

  const load = async () => {
    setLoading(true); setError('');
    try {
      let res;
      if (tab === 'routes') res = await getRouteReport(filters);
      else if (tab === 'buses') res = await getBusReport(filters);
      else res = await getDriverReport(filters);
      setData(res.data.data);
    } catch { setError('Không thể tải báo cáo'); } finally { setLoading(false); }
  };

  const tabs = [{ key: 'routes', label: 'Báo cáo tuyến 🗺️' }, { key: 'buses', label: 'Báo cáo xe 🚌' }, { key: 'drivers', label: 'Báo cáo tài xế 👤' }];

  const routeCols = [
    { key: 'route_code', label: 'Mã tuyến' }, { key: 'route_name', label: 'Tên tuyến' },
    { key: 'total_trips', label: 'Tổng chuyến' }, { key: 'executed_trips', label: 'Đã thực hiện' },
    { key: 'on_time_trips', label: 'Đúng giờ' }, { key: 'delayed_trips', label: 'Trễ' }, { key: 'cancelled_trips', label: 'Hủy' },
  ];
  const busCols = [
    { key: 'bus_id', label: 'Xe' }, { key: 'capacity', label: 'Số chỗ' }, { key: 'status', label: 'Trạng thái' },
    { key: 'total_assignments', label: 'Lần phân công' }, { key: 'executed_trips', label: 'Đã thực hiện' },
    { key: 'avg_delay_minutes', label: 'TB trễ (phút)' },
  ];
  const driverCols = [
    { key: 'driver_code', label: 'Mã' }, { key: 'full_name', label: 'Họ tên' }, { key: 'status', label: 'TT' },
    { key: 'total_assignments', label: 'Lần phân công' }, { key: 'executed_trips', label: 'Đã thực hiện' },
    { key: 'delayed_trips', label: 'Lần trễ' }, { key: 'leave_days', label: 'Ngày nghỉ' },
  ];
  const colMap = { routes: routeCols, buses: busCols, drivers: driverCols };

  return (
    <Layout>
      <PageHeader title="Báo cáo thống kê" />
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setData([]); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {/* Filters */}
      <div className="flex gap-3 mb-4 items-center">
        <input type="date" value={filters.from_date} onChange={e => setFilters({ ...filters, from_date: e.target.value })}
          placeholder="Từ ngày"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-gray-400 text-sm">đến</span>
        <input type="date" value={filters.to_date} onChange={e => setFilters({ ...filters, to_date: e.target.value })}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={load} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">Xem báo cáo</button>
      </div>
      {error && <AlertBox type="error" message={error} />}
      {loading ? <div className="text-center py-12 text-gray-500">Đang tải báo cáo...</div> : data.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {colMap[tab].map(c => <th key={c.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{c.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {colMap[tab].map(c => (
                    <td key={c.key} className="px-6 py-4 text-sm text-gray-700">
                      {row[c.key] !== null && row[c.key] !== undefined ? String(row[c.key]) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : data.length === 0 && !loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 text-center py-16 text-gray-400">
          Chọn bộ lọc và nhấn "Xem báo cáo" để tải dữ liệu
        </div>
      )}
    </Layout>
  );
}
