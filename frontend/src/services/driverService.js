import api from './api';

export const getDrivers = (params) => api.get('/drivers', { params });
export const getDriver = (id) => api.get(`/drivers/${id}`);
export const createDriver = (data) => api.post('/drivers', data);
export const updateDriver = (id, data) => api.put(`/drivers/${id}`, data);
export const updateDriverStatus = (id, status) => api.patch(`/drivers/${id}/status`, { status });
