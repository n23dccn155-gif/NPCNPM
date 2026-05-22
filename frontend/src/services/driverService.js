import api from './api';
export const getDrivers = (params) => api.get('/drivers', { params });
export const getDriver = (code) => api.get(`/drivers/${code}`);
export const createDriver = (data) => api.post('/drivers', data);
export const updateDriver = (code, data) => api.put(`/drivers/${code}`, data);
export const updateDriverStatus = (code, status) => api.patch(`/drivers/${code}/status`, { status });
