import api from './api';

export const getAssignments = (params) => api.get('/assignments', { params });
export const assignGroup = (data) => api.post('/assignments/assign', data);
export const replaceDriver = (data) => api.post('/assignments/replace-driver', {
  group_id: data.group_id,
  new_driver_id: data.new_driver_id ?? data.driver_id
});
export const replaceBus = (data) => api.post('/assignments/replace-bus', {
  group_id: data.group_id,
  new_bus_id: data.new_bus_id ?? data.bus_id
});
export const getAvailableResources = (groupId, isReplacement = false) => api.get(`/assignments/available-resources/${groupId}?is_replacement=${isReplacement}`);
