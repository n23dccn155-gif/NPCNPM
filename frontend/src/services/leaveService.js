import api from './api';
export const getMyLeaves = () => api.get('/leave-requests/my');
export const createLeave = (data) => api.post('/leave-requests', data);
export const getAllLeaves = (params) => api.get('/leave-requests', { params });
export const reviewLeave = (id, status) => api.patch(`/leave-requests/${id}/review`, { status });
export const getAffectedTrips = (id) => api.get(`/leave-requests/${id}/affected-trips`);
