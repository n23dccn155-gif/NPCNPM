import api from './api';

export const login = (credentials) => api.post('/auth/login', credentials);
export const getMe = () => api.get('/auth/me');
export const changePassword = (data) => api.put('/users/profile/password', data);
export const updateProfile = (data) => api.put('/users/profile', data);
