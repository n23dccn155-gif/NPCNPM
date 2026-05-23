// pages/admin/Configuration.jsx — Cấu hình hệ thống (matching Figma config screen)
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox } from '../../components/UI';
import { getConfigurations, updateConfiguration } from '../../services/miscService';

export default function Configuration() {
  const [configs, setConfigs] = useState([]);
  const [editing, setEditing] = useState({});
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const load = () => getConfigurations()
    .then(res => setConfigs(res.data?.data || []))
    .catch(() => setConfigs([]));

  useEffect(() => { load(); }, []);

  const handleEdit = (key, currentVal) => {
    setEditing({ ...editing, [key]: String(currentVal) });
  };

  const handleCancel = (key) => {
    const newEditing = { ...editing };
    delete newEditing[key];
    setEditing(newEditing);
  };

  const handleSave = async (key) => {
    setError(''); setSuccess('');
    try {
      await updateConfiguration(key, editing[key]);
      setSuccess(`Đã cập nhật cấu hình "${key}" thành công`);
      handleCancel(key);
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.message || 'Lỗi cập nhật cấu hình'); }
  };

  const dataTypeLabel = { number: 'Số', boolean: 'Boolean', string: 'Chuỗi' };

  return (
    <Layout>
      <PageHeader
        title="Cấu hình hệ thống"
        subtitle="Quản lý các tham số cấu hình hệ thống"
      />

      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}
      {error && <div className="mb-4"><AlertBox type="error" message={error} /></div>}

      {/* Warning notice - matching Figma */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" className="flex-shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <p className="text-sm font-medium text-amber-800">Cảnh báo</p>
          <p className="text-xs text-amber-700 mt-0.5">Thay đổi cấu hình có thể ảnh hưởng đến hoạt động của hệ thống. Vui lòng cân nhắc kỹ trước khi lưu.</p>
        </div>
      </div>

      {/* Table view - matching Figma */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Tên cấu hình', 'Giá trị', 'Kiểu dữ liệu', 'Mô tả', 'Thao tác'].map(h => (
                <th key={h} className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${h === 'Thao tác' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {configs.map(c => (
              <tr key={c.config_key} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4 font-mono text-sm text-gray-700">{c.config_key}</td>
                <td className="px-6 py-4">
                  {editing[c.config_key] !== undefined ? (
                    <input
                      type={c.data_type === 'number' ? 'number' : 'text'}
                      value={editing[c.config_key]}
                      onChange={e => setEditing({ ...editing, [c.config_key]: e.target.value })}
                      className="w-28 border border-blue-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  ) : (
                    <span className="text-sm font-semibold text-gray-900">{c.config_value}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {dataTypeLabel[c.data_type] || c.data_type}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">{c.description || '—'}</td>
                <td className="px-6 py-4 text-right">
                  {editing[c.config_key] !== undefined ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleCancel(c.config_key)}
                        className="text-xs text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg transition"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={() => handleSave(c.config_key)}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition"
                      >
                        Lưu
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(c.config_key, c.config_value)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
                    >
                      Sửa
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {configs.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">Không có cấu hình nào</div>
        )}
      </div>
    </Layout>
  );
}
