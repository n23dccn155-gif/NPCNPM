// pages/admin/Configuration.jsx
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox } from '../../components/UI';
import { getConfigurations, updateConfiguration } from '../../services/miscService';

export default function Configuration() {
  const [configs, setConfigs] = useState([]);
  const [editing, setEditing] = useState({});
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const load = () => getConfigurations().then(res => setConfigs(res.data.data));
  useEffect(() => { load(); }, []);

  const handleSave = async (key) => {
    setError(''); setSuccess('');
    try {
      await updateConfiguration(key, editing[key]);
      setSuccess(`Đã cập nhật cấu hình ${key}`);
      setEditing({ ...editing, [key]: undefined });
      load(); setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.message || 'Lỗi cập nhật'); }
  };

  return (
    <Layout>
      <PageHeader title="Cấu hình hệ thống" subtitle="Điều chỉnh tham số nghiệp vụ" />
      {success && <div className="mb-4"><AlertBox type="success" message={success} /></div>}
      {error && <div className="mb-4"><AlertBox type="error" message={error} /></div>}
      <div className="space-y-4">
        {configs.map(c => (
          <div key={c.config_key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="font-medium text-gray-900 font-mono text-sm">{c.config_key}</div>
                <div className="text-gray-500 text-sm mt-1">{c.description}</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  defaultValue={c.config_value}
                  onChange={(e) => setEditing({ ...editing, [c.config_key]: e.target.value })}
                  className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-500 text-sm">phút</span>
                {editing[c.config_key] !== undefined && (
                  <button onClick={() => handleSave(c.config_key)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
                    Lưu
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
