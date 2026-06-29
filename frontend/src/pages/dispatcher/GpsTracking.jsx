import { useEffect, useRef, useState, useCallback, useContext } from 'react';
import Layout from '../../components/Layout';
import { PageHeader, AlertBox, Modal } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import {
  getCurrentLocations,
  getBusHistory,
  getPolyline,
  listAlerts,
  acknowledgeAlert,
  listGpsDevices,
  simulateIngest,
  listRules
} from '../../services/gpsService';
import { toast } from 'react-toastify';

// Leaflet được load dynamic để giảm bundle size ban đầu
let L = null;

async function loadLeaflet() {
  if (L) return L;
  // Load CSS
  if (!document.querySelector('link[data-leaflet]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    css.crossOrigin = '';
    css.setAttribute('data-leaflet', '1');
    document.head.appendChild(css);
  }
  // Load JS
  if (window.L) { L = window.L; return L; }
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  L = window.L;
  return L;
}

const STATUS_COLORS = {
  running: '#16a34a',   // xanh lá
  assigned: '#2563eb',  // xanh dương
  scheduled: '#94a3b8', // xám
  completed: '#64748b',
  cancelled: '#dc2626',
  unknown: '#f59e0b'
};

const ALERT_COLORS = {
  off_route: '#dc2626',
  over_speed: '#f59e0b',
  long_stop: '#3b82f6',
  no_signal: '#6b7280'
};

const ALERT_LABELS = {
  off_route: 'Lệch tuyến',
  over_speed: 'Quá tốc độ',
  long_stop: 'Dừng đỗ lâu',
  no_signal: 'Mất tín hiệu'
};

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return iso; }
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

export default function GpsTracking() {
  const { user } = useAuth();
  const { socket } = useContext(SocketContext);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map()); // bus_id -> marker
  const polylinesRef = useRef(new Map()); // route_code+direction -> polyline

  const [locations, setLocations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBus, setSelectedBus] = useState(null);
  const [busHistory, setBusHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);

  // Init map
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const leaflet = await loadLeaflet();
        if (!mounted || mapInstanceRef.current) return;
        // Trung tâm: TP.HCM
        const map = leaflet.map(mapRef.current, {
          center: [10.776, 106.700],
          zoom: 12,
          zoomControl: true
        });
        leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19
        }).addTo(map);
        mapInstanceRef.current = map;
      } catch (e) {
        console.error(e);
        setError('Không thể tải bản đồ. Kiểm tra kết nối Internet.');
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load dữ liệu ban đầu
  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [locRes, alertRes, devRes, ruleRes] = await Promise.all([
        getCurrentLocations(),
        listAlerts({ status: 'new', limit: 50 }),
        listGpsDevices(),
        listRules()
      ]);
      setLocations(Array.isArray(locRes.data) ? locRes.data : []);
      setAlerts(Array.isArray(alertRes.data) ? alertRes.data : []);
      setDevices(Array.isArray(devRes.data) ? devRes.data : []);
      setRules(Array.isArray(ruleRes.data) ? ruleRes.data : []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Không thể tải dữ liệu GPS');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // Render markers khi có locations
  const renderMarkers = useCallback(async (locs) => {
    if (!mapInstanceRef.current || !L) return;
    const map = mapInstanceRef.current;
    const markers = markersRef.current;

    locs.forEach(loc => {
      const lat = parseFloat(loc.latitude);
      const lng = parseFloat(loc.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const color = STATUS_COLORS[loc.bus_status] || STATUS_COLORS.unknown;
      const busKey = String(loc.bus_id);

      // Popup content
      const popup = `
        <div style="font-family: sans-serif; font-size: 12px; min-width: 180px;">
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">🚌 ${loc.license_plate || 'Bus #' + loc.bus_id}</div>
          <div style="margin-top: 4px; color: #475569;">📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
          <div style="color: #475569;">⚡ ${(loc.speed_kmh || 0).toFixed(1)} km/h</div>
          ${loc.driver_name ? `<div style="color: #475569;">👤 ${loc.driver_name}</div>` : ''}
          ${loc.route_code ? `<div style="color: #2563eb; font-weight: 600;">Tuyến ${loc.route_code} (${loc.direction_type === 'outbound' ? 'đi' : 'về'})</div>` : ''}
          <div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">Cập nhật: ${fmtTime(loc.recorded_at)}</div>
        </div>
      `;

      const iconHtml = `<div style="
        background: ${color};
        width: 28px; height: 28px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        color: white; font-size: 14px; font-weight: bold;
      ">${(loc.heading || 0).toFixed(0)}°</div>`;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'bus-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      if (markers.has(busKey)) {
        const m = markers.get(busKey);
        m.setLatLng([lat, lng]);
        m.setIcon(icon);
        m.setPopupContent(popup);
      } else {
        const m = L.marker([lat, lng], { icon }).addTo(map);
        m.bindPopup(popup);
        m.on('click', () => setSelectedBus(loc));
        markers.set(busKey, m);
      }
    });

    // Xóa marker không còn trong danh sách
    const activeKeys = new Set(locs.map(l => String(l.bus_id)));
    for (const [key, m] of markers.entries()) {
      if (!activeKeys.has(key)) {
        m.remove();
        markers.delete(key);
      }
    }
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && L) renderMarkers(locations);
  }, [locations, renderMarkers]);

  // Load polyline cho xe được chọn
  const loadRoutePolyline = useCallback(async (loc) => {
    if (!L || !mapInstanceRef.current || !loc.route_code) return;
    const key = `${loc.route_code}_${loc.direction_type}`;
    if (polylinesRef.current.has(key)) return; // đã vẽ rồi

    try {
      const res = await getPolyline(loc.route_code, loc.direction_type);
      const points = Array.isArray(res.data) ? res.data : [];
      if (points.length < 2) return;

      const latlngs = points.map(p => [parseFloat(p.latitude), parseFloat(p.longitude)]);
      const polyline = L.polyline(latlngs, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.7,
        dashArray: '8 6'
      }).addTo(mapInstanceRef.current);
      polyline.bindPopup(`Quỹ đạo tuyến ${loc.route_code}`);
      polylinesRef.current.set(key, polyline);

      // Fit map vào polyline + marker
      const busMarker = markersRef.current.get(String(loc.bus_id));
      if (busMarker) {
        const group = L.featureGroup([polyline, busMarker]);
        mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2));
      }
    } catch (err) {
      console.warn('Không load được polyline:', err.message);
    }
  }, []);

  useEffect(() => {
    if (selectedBus) loadRoutePolyline(selectedBus);
  }, [selectedBus, loadRoutePolyline]);

  // Socket: lắng nghe vị trí + alert realtime
  useEffect(() => {
    if (!socket) return;
    const onLocation = (data) => {
      setLocations(prev => {
        const idx = prev.findIndex(l => l.bus_id === data.bus_id);
        if (idx >= 0) {
          const updated = { ...prev[idx], ...data };
          return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
        }
        return [...prev, data];
      });
    };
    const onAlert = (alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 50));
      const label = ALERT_LABELS[alert.alert_type] || alert.alert_type;
      toast.warn(`⚠️ ${label}: ${alert.message}`, {
        position: 'top-right',
        autoClose: 8000
      });
    };
    socket.on('BUS_LOCATION', onLocation);
    socket.on('GPS_ALERT', onAlert);
    return () => {
      socket.off('BUS_LOCATION', onLocation);
      socket.off('GPS_ALERT', onAlert);
    };
  }, [socket]);

  // Xem lịch sử 1 xe
  const viewHistory = async (bus) => {
    setSelectedBus(bus);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await getBusHistory(bus.bus_id, { limit: 200 });
      setBusHistory(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error('Không thể tải lịch sử hành trình');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Xác nhận alert
  const handleAcknowledge = async (alertId) => {
    try {
      await acknowledgeAlert(alertId);
      setAlerts(prev => prev.filter(a => a.alert_id !== alertId));
      toast.success('Đã xác nhận cảnh báo');
    } catch (e) {
      toast.error('Lỗi khi xác nhận');
    }
  };

  // Tính stats
  const stats = {
    total: locations.length,
    running: locations.filter(l => l.trip_id).length,
    newAlerts: alerts.filter(a => a.status === 'new').length,
    onlineDevices: devices.filter(d => d.status === 'active').length
  };

  // Center map về xe đang chọn
  const focusBus = (bus) => {
    setSelectedBus(bus);
    if (bus && mapInstanceRef.current) {
      mapInstanceRef.current.setView(
        [parseFloat(bus.latitude), parseFloat(bus.longitude)],
        16,
        { animate: true }
      );
      const marker = markersRef.current.get(String(bus.bus_id));
      if (marker) marker.openPopup();
    }
  };

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (!user) return null;

  return (
    <Layout>
      <PageHeader
        title="🚍 Giám sát xe buýt theo thời gian thực"
        subtitle={`Hệ thống GPS • ${stats.total} xe đang theo dõi • ${stats.onlineDevices} thiết bị online`}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowSimulator(true)}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition"
              title="Mô phỏng gửi dữ liệu GPS (dùng để test khi chưa có thiết bị thật)"
            >
              📡 Mô phỏng GPS
            </button>
            <button
              onClick={loadInitial}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
            >
              🔄 Tải lại
            </button>
          </div>
        }
      />

      {error && <div className="mb-4"><AlertBox type="error" message={error} /></div>}

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-slate-100 p-3">
          <div className="text-xs text-slate-500 font-medium">Tổng xe</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3">
          <div className="text-xs text-slate-500 font-medium">Đang chạy</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.running}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3">
          <div className="text-xs text-slate-500 font-medium">Cảnh báo mới</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{stats.newAlerts}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3">
          <div className="text-xs text-slate-500 font-medium">Thiết bị GPS</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{stats.onlineDevices}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Bản đồ */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div ref={mapRef} style={{ height: 'calc(100vh - 280px)', minHeight: '500px', width: '100%' }} />
        </div>

        {/* Panel bên phải: danh sách xe + cảnh báo */}
        <div className="space-y-4">
          {/* Danh sách xe */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-700">🚍 Xe đang theo dõi ({locations.length})</h3>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-slate-400 text-sm">Đang tải...</div>
              ) : locations.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">
                  <div className="text-3xl mb-2">📡</div>
                  Chưa có dữ liệu GPS
                </div>
              ) : (
                locations.map(loc => (
                  <div
                    key={loc.bus_id}
                    className={`px-3 py-2.5 border-b border-slate-50 last:border-b-0 cursor-pointer hover:bg-slate-50 transition ${selectedBus?.bus_id === loc.bus_id ? 'bg-blue-50' : ''}`}
                    onClick={() => focusBus(loc)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[loc.bus_status] || STATUS_COLORS.unknown }} />
                          {loc.license_plate || `Bus #${loc.bus_id}`}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          ⚡ {(loc.speed_kmh || 0).toFixed(0)} km/h
                          {loc.route_code && <span className="ml-2 text-blue-600 font-semibold">Tuyến {loc.route_code}</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{timeAgo(loc.recorded_at)}</div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); viewHistory(loc); }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex-shrink-0"
                      >
                        📜
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cảnh báo */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-700">⚠️ Cảnh báo ({alerts.length})</h3>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">
                  <div className="text-3xl mb-2">✅</div>
                  Không có cảnh báo
                </div>
              ) : (
                alerts.map(alert => (
                  <div key={alert.alert_id} className="px-3 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50">
                    <div className="flex items-start gap-2">
                      <span
                        className="inline-block w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: ALERT_COLORS[alert.alert_type] || '#6b7280' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-800">
                          {ALERT_LABELS[alert.alert_type] || alert.alert_type}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5 leading-snug line-clamp-2">
                          {alert.message}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {alert.license_plate} • {timeAgo(alert.created_at)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAcknowledge(alert.alert_id)}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex-shrink-0"
                        title="Xác nhận đã xử lý"
                      >
                        ✓
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Rules */}
          {rules.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-700">⚙️ Rule cảnh báo</h3>
              </div>
              <div className="p-3 text-xs space-y-1.5">
                {rules.map(r => (
                  <div key={r.rule_id} className="flex justify-between">
                    <span className="text-slate-700 font-medium">{ALERT_LABELS[r.alert_type] || r.alert_type}:</span>
                    <span className="text-slate-600 font-mono">
                      {r.threshold_value != null
                        ? r.alert_type === 'long_stop' || r.alert_type === 'no_signal'
                          ? `${Math.floor(r.threshold_value / 60)} phút`
                          : `${r.threshold_value} ${r.alert_type === 'over_speed' ? 'km/h' : 'm'}`
                        : '—'}
                      {' '}• cooldown {Math.floor(r.cooldown_seconds / 60)}p
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: lịch sử hành trình */}
      <Modal isOpen={showHistoryModal} title={`Lịch sử hành trình - ${selectedBus?.license_plate || ''}`} onClose={() => setShowHistoryModal(false)}>
        {historyLoading ? (
          <div className="text-center text-slate-400 py-8">Đang tải lịch sử...</div>
        ) : busHistory.length === 0 ? (
          <div className="text-center text-slate-400 py-8">Chưa có lịch sử hành trình</div>
        ) : (
          <>
            <div className="text-xs text-slate-500 mb-3">
              {busHistory.length} điểm • từ {fmtDateTime(busHistory[0].recorded_at)} đến {fmtDateTime(busHistory[busHistory.length - 1].recorded_at)}
            </div>
            <div className="bg-slate-50 rounded-xl p-3 max-h-96 overflow-y-auto text-xs font-mono">
              {busHistory.map((p, i) => (
                <div key={p.location_id} className="flex justify-between py-1 border-b border-slate-200 last:border-b-0">
                  <span className="text-slate-400 w-10">#{i + 1}</span>
                  <span className="text-slate-700 flex-1">
                    {parseFloat(p.latitude).toFixed(5)}, {parseFloat(p.longitude).toFixed(5)}
                  </span>
                  <span className="text-slate-500 w-20 text-right">{(p.speed_kmh || 0).toFixed(0)} km/h</span>
                  <span className="text-slate-400 w-20 text-right">{fmtTime(p.recorded_at)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* Modal: GPS Simulator (dùng để test) */}
      <GpsSimulatorModal
        isOpen={showSimulator}
        onClose={() => setShowSimulator(false)}
        devices={devices.filter(d => d.status === 'active')}
        onSubmitted={async () => {
          await loadInitial();
          toast.success('Đã gửi dữ liệu GPS mô phỏng');
        }}
        simulateIngest={simulateIngest}
      />
    </Layout>
  );
}

// ============== GPS Simulator Modal ==============
function GpsSimulatorModal({ isOpen, onClose, devices, onSubmitted, simulateIngest }) {
  const [deviceCode, setDeviceCode] = useState('');
  const [lat, setLat] = useState('10.776');
  const [lng, setLng] = useState('106.700');
  const [speed, setSpeed] = useState('40');
  const [heading, setHeading] = useState('90');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && devices.length > 0 && !deviceCode) {
      setDeviceCode(devices[0].device_code);
    }
  }, [isOpen, devices, deviceCode]);

  const submit = async () => {
    if (!deviceCode) { toast.error('Chọn thiết bị'); return; }
    setSubmitting(true);
    try {
      await simulateIngest({
        device_code: deviceCode,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        speed_kmh: parseFloat(speed),
        heading: parseFloat(heading)
      });
      onSubmitted();
    } catch (e) {
      toast.error('Lỗi: ' + (e.response?.data?.message || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;
  return (
    <Modal isOpen={true} title="📡 Mô phỏng gửi dữ liệu GPS" onClose={onClose}>
      <div className="space-y-3">
        <AlertBox type="info" message="Dùng để test khi chưa có thiết bị GPS thật. Nhập tọa độ rồi bấm Gửi để mô phỏng 1 lần gửi dữ liệu." />
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Thiết bị</label>
          <select value={deviceCode} onChange={e => setDeviceCode(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            {devices.length === 0 && <option value="">Chưa có thiết bị active - hãy đăng ký trước</option>}
            {devices.map(d => (
              <option key={d.device_id} value={d.device_code}>
                {d.device_code} (Bus #{d.bus_id} - {d.license_plate})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Vĩ độ (latitude)</label>
            <input type="number" step="0.00001" value={lat} onChange={e => setLat(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Kinh độ (longitude)</label>
            <input type="number" step="0.00001" value={lng} onChange={e => setLng(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tốc độ (km/h)</label>
            <input type="number" step="0.1" value={speed} onChange={e => setSpeed(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hướng (0-359°)</label>
            <input type="number" min="0" max="359" value={heading} onChange={e => setHeading(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">Đóng</button>
          <button onClick={submit} disabled={submitting || !deviceCode} className="px-4 py-2 text-sm rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
            {submitting ? 'Đang gửi...' : '📡 Gửi 1 packet GPS'}
          </button>
        </div>
      </div>
    </Modal>
  );
}