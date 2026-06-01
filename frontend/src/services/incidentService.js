import api from './api';

export const getMyIncidents = () => api.get('/incidents/my');
export const createIncident = (data) => api.post('/incidents', data);
export const getAllIncidents = (params) => api.get('/incidents', { params });
export const updateIncidentStatus = (id, status) => api.patch(`/incidents/${id}/status`, { status });
export const getAffectedGroups = (id) => api.get(`/incidents/${id}/affected-groups`);
