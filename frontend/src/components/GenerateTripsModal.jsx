import React, { useState } from 'react';
import { Modal } from './UI';

export default function GenerateTripsModal({ isOpen, onClose, onGenerate, isReGenerate }) {
  const [formData, setFormData] = useState({
    travel_time: 80,
    headway_minutes: 15,
    short_layover: 10,
    long_layover: 15,
    max_driving_minutes: 240,
    standby_ratio: 0.15
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: Number(e.target.value) });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onGenerate(formData);
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={isReGenerate ? 'Tái sinh chuyến & Phân ca' : 'Sinh chuyến & Phân ca nâng cao'}
    >
      <form onSubmit={handleSubmit} className="space-y-4 w-[500px]">
        <div className="text-sm text-gray-500 mb-4">
          Nhập các tham số để hệ thống tự động sinh chuyến và tính toán số lượng xe, tài xế cần thiết (Load Balancing Run Cutting).
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian chạy (phút)</label>
            <input
              type="number"
              name="travel_time"
              value={formData.travel_time}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Giãn cách (phút)</label>
            <input
              type="number"
              name="headway_minutes"
              value={formData.headway_minutes}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nghỉ ngắn tại bến (phút)</label>
            <input
              type="number"
              name="short_layover"
              value={formData.short_layover}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nghỉ dài / Đổi ca (phút)</label>
            <input
              type="number"
              name="long_layover"
              value={formData.long_layover}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Giới hạn lái liên tục (phút)</label>
            <input
              type="number"
              name="max_driving_minutes"
              value={formData.max_driving_minutes}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tỉ lệ Dự bị (Ví dụ 0.15)</label>
            <input
              type="number"
              step="0.01"
              name="standby_ratio"
              value={formData.standby_ratio}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Tiến hành Sinh chuyến
          </button>
        </div>
      </form>
    </Modal>
  );
}
