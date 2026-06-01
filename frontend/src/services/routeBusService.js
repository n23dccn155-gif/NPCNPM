import api from './api';

export const getRouteBuses = (routeCode) => api.get(`/routes/${routeCode}/buses`);
export const addBusToRoute = (routeCode, data) => api.post(`/routes/${routeCode}/buses`, data);
export const removeBusFromRoute = (routeCode, busId) => api.delete(`/routes/${routeCode}/buses/${busId}`);
