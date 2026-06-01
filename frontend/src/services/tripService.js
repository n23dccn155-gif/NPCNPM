import api from './api';

export const getTrips = (params) => api.get('/trips', { params });
export const getTrip = (id) => api.get(`/trips/${id}`);
export const getMyTrips = (date) => api.get('/trips/my-trips', { params: { date } });
export const startTrip = (id) => api.post(`/trips/${id}/start`);
export const finishTrip = (id) => api.post(`/trips/${id}/finish`);
export const cancelTrip = (id, reason) => api.post(`/trips/${id}/cancel`, { reason });
