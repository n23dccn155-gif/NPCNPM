import api from './api';

export const getDirections = (routeCode) => api.get(`/routes/${routeCode}/directions`);
export const getStops = (directionId) => api.get(`/routes/directions/${directionId}/stops`);
export const createStop = (data) => api.post('/routes/stops', data);
export const updateStop = (stopId, data) => api.put(`/routes/stops/${stopId}`, data);
export const deleteStop = (stopId) => api.delete(`/routes/stops/${stopId}`);
