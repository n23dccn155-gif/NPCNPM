import api from './api';

export const getRouteReport = () => api.get('/reports/routes');
export const getBusReport = () => api.get('/reports/buses');
export const getDriverReport = () => api.get('/reports/drivers');
