import api from './api';

export const getMyLeaves = () => api.get('/leave-requests/my');
export const createLeave = (data) => api.post('/leave-requests', data);
export const getAllLeaves = (params) => api.get('/leave-requests', { params });
export const reviewLeave = (id, status) => api.post(`/leave-requests/${id}/review`, { status });
export const getAffectedGroups = (id) => api.get(`/leave-requests/${id}/affected-groups`);
