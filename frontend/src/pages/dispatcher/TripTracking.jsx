import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { formatDate } from '../../utils/format';
import { PageHeader, AlertBox } from '../../components/UI';
import { getTrips } from '../../services/tripService';

export default function TripTracking() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getTrips({ date: filterDate });
      setTrips(res.data?.data || res.data || []);
    } catch (err) {
      console.error(err);
      setError('Không thể tải nhật ký thực hiện chuyến xe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterDate]);

  const statusLabel = {
    scheduled: 'Đã lên lịch',
    running: 'Đang chạy',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy'
  };

  const statusColor = {
    scheduled: 'bg-blue-50 text-blue-700',
    running: 'bg-green-50 text-green-700',
    completed: 'bg-slate-50 text-slate-700',
    cancelled: 'bg-red-50 text-red-700'
  };

  return (
    <Layout>
      <PageHeader
        title="Nhật ký thực hiện chuyến xe"
        subtitle="Giám sát thực tế thời gian xuất bến, cập bến và trễ chuyến của tài xế"
        action={
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ngày giám sát:</label>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        }
      />

      {error && <div className="mb-4"><AlertBox type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="text-sm font-bold text-gray-700">Tiến độ vận hành chuyến xe trong ngày</h3>
          <span className="text-xs font-bold text-slate-400">Tổng: {trips.length} chuyến</span>
        </div>
        
        {loading ? (
          <div className="text-center py-16 text-slate-400 font-semibold animate-pulse">Đang nạp dữ liệu hành trình...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {['Thứ tự', 'Nhóm chuyến', 'Tuyến', 'Chiều', 'Mã xe & Tài xế', 'Giờ KH', 'Giờ xuất thực tế', 'Giờ cập thực tế', 'Phút trễ', 'Trạng thái'].map(h => (
                    <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {trips.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-gray-400">
                      Không có chuyến xe nào vận hành trong ngày {formatDate(filterDate)}
                    </td>
                  </tr>
                ) : (
                  trips.map(t => (
                    <tr key={t.trip_id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-mono font-bold text-slate-800">#{t.trip_order}</td>
                      <td className="px-6 py-4 font-bold text-slate-700">{t.group_name}</td>
                      <td className="px-6 py-4 font-bold text-blue-600">{t.route_code}</td>
                      <td className="px-6 py-4 text-xs font-semibold">
                        {t.direction_type === 'outbound' ? 'Chiều đi' : 'Chiều về'}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="font-bold text-slate-800">Xe: {t.license_plate || '—'}</div>
                        <div className="text-slate-500 font-medium mt-0.5">TX: {t.driver_name || '—'}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono font-semibold text-slate-600">
                        {new Date(t.scheduled_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(t.scheduled_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono font-semibold text-slate-700">
                        {t.actual_departure ? new Date(t.actual_departure).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono font-semibold text-slate-700">
                        {t.actual_arrival ? new Date(t.actual_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono font-bold">
                        {t.delay_minutes > 0 ? (
                          <span className="text-red-600">+{t.delay_minutes} phút</span>
                        ) : t.actual_departure ? (
                          <span className="text-green-600">Đúng giờ</span>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColor[t.status] || 'bg-slate-100 text-slate-700'}`}>
                          {statusLabel[t.status] || t.status}
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
