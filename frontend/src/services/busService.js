import api from './api';
export const getBuses = (params) => api.get('/buses', { params });
export const getBus = (id) => api.get(`/buses/${id}`);
export const createBus = (data) => api.post('/buses', data);
export const updateBus = (id, data) => api.put(`/buses/${id}`, data);
export const updateBusStatus = (id, status) => api.patch(`/buses/${id}/status`, { status });
