import api from './api';
export const getRoutes = (params) => api.get('/routes', { params });
export const getRoute = (code) => api.get(`/routes/${code}`);
export const createRoute = (data) => api.post('/routes', data);
export const updateRoute = (code, data) => api.put(`/routes/${code}`, data);
export const updateRouteStatus = (code, status) => api.patch(`/routes/${code}/status`, { status });
