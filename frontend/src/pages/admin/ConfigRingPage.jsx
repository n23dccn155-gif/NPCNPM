import { useState, useEffect } from 'react';
import { getConfigurationSchedules, createConfigurationSchedule } from '../../services/miscService';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox } from '../../components/UI';

export default function ConfigRingPage() {
  const [config, setConfig] = useState({
    effective_date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0],
    morning_shift_start: '05:30',
    morning_shift_end: '14:00',
    afternoon_shift_start: '14:00',
    afternoon_shift_end: '22:30',
    standby_percentage: 10,
    min_break_minutes: 10,
    trip_duration_minutes: 75,
    trip_frequency_minutes: 15
  });

  const [schedules, setSchedules] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchSchedules = async () => {
    try {
      const res = await getConfigurationSchedules();
      const data = res.data?.data || [];
      setSchedules(data);
      if (data.length > 0) {
        const latest = data[0];
        setConfig({
          ...latest,
          effective_date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]
        });
      }
    } catch {
      setErrorMsg('Lỗi khi tải lịch sử cấu hình');
      setSchedules([]);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSchedules();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newConfig = { ...config, [name]: value };

    if (name === 'morning_shift_end') {
      newConfig.afternoon_shift_start = value;
    }

    setConfig(newConfig);
    
    // Luôn xoá lỗi API cũ khi user sửa dữ liệu để họ có thể submit lại
    setErrorMsg('');

    // Sau đó kiểm tra lại lỗi logic giờ giấc
    if (newConfig.morning_shift_end !== newConfig.afternoon_shift_start) {
      setErrorMsg('Giờ kết thúc ca sáng phải trùng với giờ bắt đầu ca chiều!');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (config.morning_shift_end !== config.afternoon_shift_start) {
      setErrorMsg('Vui lòng sửa lỗi trước khi lưu');
      return;
    }
    
    const confirmMsg = `Bạn đang áp dụng cấu hình này từ ngày ${config.effective_date}.\nHệ thống sẽ tính toán lại TOÀN BỘ chuyến xe và lịch phân công từ ngày này trở đi.\nBạn có chắc chắn?`;
    if (!window.confirm(confirmMsg)) return;

    setErrorMsg('');
    setSuccessMsg('');

    try {
      await createConfigurationSchedule(config);
      setSuccessMsg('Lưu cấu hình và cập nhật lịch trình thành công!');
      fetchSchedules();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Cấu hình thuật toán"
        subtitle="Thiết lập các tham số cho bộ não điều phối xe buýt"
      />
      
      {successMsg && <div className="mb-4"><AlertBox type="success" message={successMsg} /></div>}
      {errorMsg && <div className="mb-4"><AlertBox type="error" message={errorMsg} /></div>}

      <div className="flex flex-col md:flex-row gap-6">
        {/* Form cấu hình */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h5 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Tham số điều phối</h5>
            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giờ bắt đầu Ca Sáng</label>
                  <input type="time" name="morning_shift_start" value={config.morning_shift_start} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giờ kết thúc Ca Sáng</label>
                  <input type="time" name="morning_shift_end" value={config.morning_shift_end} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giờ bắt đầu Ca Chiều</label>
                  <input type="time" name="afternoon_shift_start" value={config.afternoon_shift_start} disabled className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-gray-500" />
                  <p className="text-xs text-gray-500 mt-1">Đồng bộ tự động từ Ca Sáng</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giờ kết thúc Ca Chiều</label>
                  <input type="time" name="afternoon_shift_end" value={config.afternoon_shift_end} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>

              <hr className="border-gray-200" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nghỉ giữa chuyến (phút)</label>
                  <select name="min_break_minutes" value={config.min_break_minutes} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="5">5 phút</option>
                    <option value="10">10 phút</option>
                    <option value="15">15 phút</option>
                    <option value="20">20 phút</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tần suất xuất bến (phút)</label>
                  <input type="number" name="trip_frequency_minutes" value={config.trip_frequency_minutes} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tỷ lệ dự bị (%)</label>
                  <input type="number" name="standby_percentage" value={config.standby_percentage} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500" min="0" max="100" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-red-600 mb-1">Ngày bắt đầu áp dụng</label>
                  <input type="date" name="effective_date" value={config.effective_date} onChange={handleChange} required className="w-full border border-red-300 bg-red-50 rounded-lg px-3 py-2 focus:ring-red-500 focus:border-red-500" />
                </div>
              </div>

              <button type="submit" disabled={!!errorMsg} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition shadow-md mt-4">
                Lưu & Áp dụng ngay
              </button>
            </form>
          </div>
        </div>

        {/* Lịch sử cấu hình */}
        <div className="w-full md:w-1/3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100">
              <h5 className="font-bold text-gray-800">Lịch sử cấu hình</h5>
            </div>
            <div className="p-4 overflow-y-auto" style={{ maxHeight: '500px' }}>
              {schedules.map((s, idx) => (
                <div key={idx} className="mb-4 p-4 rounded-xl border bg-slate-50">
                  <h6 className="text-blue-700 font-bold mb-2">📅 Áp dụng từ: {new Date(s.effective_date).toLocaleDateString('vi-VN')}</h6>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><span className="font-semibold">Ca Sáng:</span> {s.morning_shift_start} - {s.morning_shift_end}</p>
                    <p><span className="font-semibold">Ca Chiều:</span> {s.afternoon_shift_start} - {s.afternoon_shift_end}</p>
                    <p><span className="font-semibold">Nghỉ giữa chuyến:</span> {s.min_break_minutes} phút</p>
                    <p><span className="font-semibold">Giãn cách:</span> {s.trip_frequency_minutes} phút</p>
                    <p><span className="font-semibold">Dự bị:</span> {s.standby_percentage}%</p>
                  </div>
                </div>
              ))}
              {schedules.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Chưa có lịch sử cấu hình.</p>}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
