import api from './api';
export const createIncident = (data) => api.post('/incidents', data);
export const getMyIncidents = () => api.get('/incidents/my');
export const getAllIncidents = (params) => api.get('/incidents', { params });
export const updateIncidentStatus = (id, status) => api.patch(`/incidents/${id}/status`, { status });
export const getIncidentAffectedTrips = (id) => api.get(`/incidents/${id}/affected-trips`);

export const getRouteReport = (params) => api.get('/reports/routes', { params });
export const getBusReport = (params) => api.get('/reports/buses', { params });
export const getDriverReport = (params) => api.get('/reports/drivers', { params });

export const getUsers = () => api.get('/users');
export const createUser = (data) => api.post('/users', data);
export const updateUserStatus = (id, status) => api.patch(`/users/${id}/status`, { status });
export const updateUserRole = (id, role_id) => api.patch(`/users/${id}/role`, { role_id });

export const getConfigurations = () => api.get('/configurations');
export const updateConfiguration = (key, value) => api.put(`/configurations/${key}`, { config_value: value });

export const changePassword = (data) => api.put('/profile/password', data);
export const updateProfile = (data) => api.put('/profile', data);
