import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox } from '../../components/UI';
import { getRouteReport, getBusReport, getDriverReport } from '../../services/reportService';

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
    { key: 'avg_delay_minutes', label: 'Trễ TB (phút)' },
  ],
  buses: [
    { key: 'license_plate', label: 'Biển số xe' },
    { key: 'total_assignments', label: 'Lần phân công' },
    { key: 'trips_run', label: 'Chuyến đã chạy' },
    { key: 'cancelled_trips', label: 'Chuyến hủy liên quan', color: '#dc2626' },
    { key: 'incident_count', label: 'Số sự cố', color: '#dc2626' },
    { key: 'status', label: 'Trạng thái hiện tại' },
  ],
  drivers: [
    { key: 'full_name', label: 'Họ tên tài xế' },
    { key: 'username', label: 'Tên tài khoản' },
    { key: 'total_assignments', label: 'Lần phân công' },
    { key: 'executed_trips', label: 'Đã chạy thực tế' },
    { key: 'delayed_trips', label: 'Số chuyến trễ', color: '#dc2626' },
    { key: 'total_driving_hours', label: 'Tổng giờ lái' },
    { key: 'leaves_approved', label: 'Ngày nghỉ đã duyệt' },
    { key: 'incidents_reported', label: 'Sự cố đã báo', color: '#dc2626' },
    { key: 'status', label: 'Trạng thái hiện tại' },
  ],
};

export default function Reports() {
  const [tab, setTab] = useState('routes');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = async (activeTab = tab) => {
    setLoading(true);
    setError('');
    try {
      let res;
      if (activeTab === 'routes') res = await getRouteReport();
      else if (activeTab === 'buses') res = await getBusReport();
      else res = await getDriverReport();

      setData(res.data?.data || res.data || []);
      setHasLoaded(true);
    } catch (err) {
      console.error(err);
      setError('Không thể tải dữ liệu báo cáo thống kê');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(tab);
  }, [tab]);

  const handleTabChange = (key) => {
    setTab(key);
  };

  const cols = COLS[tab];

  const formatVal = (row, col) => {
    const val = row[col.key];
    if (val === null || val === undefined) return '—';
    if (col.format === 'pct') {
      const parsedVal = parseFloat(val);
      return isNaN(parsedVal) ? val : `${(parsedVal * 100).toFixed(1)}%`;
    }
    return String(val);
  };

  const getColor = (col, val) => {
    if (!col.color) return 'text-gray-700';
    const num = Number(val);
    if (isNaN(num) || num === 0) return 'text-gray-700';
    return col.color === '#16a34a' ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold';
  };

  const busStatusLabel = { active: 'Hoạt động', broken: 'Hỏng', inactive: 'Ngưng' };
  const busStatusBg = { active: 'bg-green-50 text-green-700', broken: 'bg-red-50 text-red-700', inactive: 'bg-slate-50 text-slate-700' };

  const driverStatusLabel = { working: 'Đang làm', on_leave: 'Nghỉ phép', inactive: 'Ngưng' };
  const driverStatusBg = { working: 'bg-green-50 text-green-700', on_leave: 'bg-amber-50 text-amber-700', inactive: 'bg-slate-50 text-slate-700' };

  return (
    <Layout>
      <PageHeader
        title="Báo cáo thống kê hiệu suất"
        subtitle="Theo dõi và đánh giá năng lực hoạt động của đội ngũ tài xế, xe buýt và các tuyến xe"
      />

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6 overflow-hidden">
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 -mb-px ${tab === t.key
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Action Bar */}
        <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
          <span className="text-sm font-medium text-slate-500">
            Báo cáo tổng hợp số liệu thực tế từ dữ liệu vận hành chuyến
          </span>
          <button
            onClick={load}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/10 transition flex items-center gap-2"
          >
            Xuất báo cáo
          </button>
        </div>

        {/* Table View */}
        {error && <div className="p-5"><AlertBox type="error" message={error} /></div>}

        {loading ? (
          <div className="text-center py-20 text-slate-400 font-semibold animate-pulse">Đang tính toán số liệu thống kê...</div>
        ) : data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {cols.map(c => (
                    <th key={c.key} className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    {cols.map(c => {
                      const raw = row[c.key];
                      const val = formatVal(row, c);

                      if (c.key === 'status') {
                        const isBus = tab === 'buses';
                        const badgeClass = isBus ? busStatusBg[raw] : driverStatusBg[raw];
                        const text = isBus ? busStatusLabel[raw] : driverStatusLabel[raw];
                        return (
                          <td key={c.key} className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass || 'bg-slate-100 text-slate-700'}`}>
                              {text || raw || '—'}
                            </span>
                          </td>
                        );
                      }

                      if (c.key === 'on_time_rate') {
                        const pct = typeof raw === 'number' ? (raw * 100).toFixed(1) : parseFloat(raw);
                        const isGood = !isNaN(pct) && pct >= 80;
                        return (
                          <td key={c.key} className="px-6 py-4 font-bold">
                            {!isNaN(pct) ? (
                              <span className={isGood ? 'text-green-600' : 'text-red-600'}>{pct}%</span>
                            ) : '—'}
                          </td>
                        );
                      }

                      return (
                        <td key={c.key} className={`px-6 py-4 font-medium ${getColor(c, raw)}`}>{val}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : hasLoaded ? (
          <div className="text-center py-20 text-slate-400 font-semibold">Không tìm thấy dữ liệu vận hành nào phù hợp</div>
        ) : (
          <div className="text-center py-20 text-slate-400 font-semibold">
            Nhấn nút <strong className="text-blue-600">"Xuất báo cáo"</strong> ở trên để tổng hợp dữ liệu thống kê mới nhất
          </div>
        )}
      </div>
    </Layout>
  );
}
