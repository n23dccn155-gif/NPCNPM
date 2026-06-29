import api from './api';

// ============== DEVICES ==============
export const listGpsDevices = () => api.get('/gps/devices');
export const registerGpsDevice = (data) => api.post('/gps/devices', data);
export const updateGpsDevice = (id, data) => api.patch(`/gps/devices/${id}`, data);

// ============== INGEST (test từ frontend, thiết bị thật gọi trực tiếp) ==============
export const simulateIngest = (data) => api.post('/gps/ingest', data);

// ============== TRACKING ==============
export const getCurrentLocations = () => api.get('/gps/tracking');
export const getCurrentByBus = (busId) => api.get(`/gps/tracking/${busId}`);
export const getBusHistory = (busId, params = {}) =>
  api.get(`/gps/history/${busId}`, { params });

// ============== POLYLINES ==============
export const upsertPolyline = (data) => api.post('/gps/polylines', data);
export const getPolyline = (routeCode, directionType) =>
  api.get(`/gps/polylines/${routeCode}/${directionType}`);

// ============== ALERTS ==============
export const listAlerts = (params = {}) => api.get('/gps/alerts', { params });
export const acknowledgeAlert = (id) => api.patch(`/gps/alerts/${id}/acknowledge`);
export const resolveAlert = (id) => api.patch(`/gps/alerts/${id}/resolve`);

// ============== RULES ==============
export const listRules = () => api.get('/gps/rules');
export const updateRule = (id, data) => api.patch(`/gps/rules/${id}`, data);