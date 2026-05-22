import api from './api';
export const getTrips = (params) => api.get('/trips', { params });
export const getTrip = (code) => api.get(`/trips/${code}`);
export const createTrip = (data) => api.post('/trips', data);

export const getSchedule = (params) => api.get('/assignments/schedule', { params });
export const checkAssignment = (data) => api.post('/assignments/check', data);
export const createAssignment = (data) => api.post('/assignments', data);
export const replaceAssignment = (tripCode, data) => api.post(`/assignments/${tripCode}/replace`, data);
export const getAssignmentHistory = (tripCode) => api.get(`/assignments/history/${tripCode}`);

export const getTripLogs = () => api.get('/trip-logs');
export const getTripLog = (code) => api.get(`/trip-logs/${code}`);
export const createTripLog = (data) => api.post('/trip-logs', data);
