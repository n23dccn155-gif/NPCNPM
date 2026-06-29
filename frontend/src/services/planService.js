import api from './api';

export const getPlans = (params) => api.get('/plans', { params });
export const getPlan = (id) => api.get(`/plans/${id}`);
export const createPlan = (data) => api.post('/plans', data);
export const generateTrips = (planId, data = {}) => api.post(`/plans/${planId}/generate-trips`, data);
export const submitPlan = (planId, params = {}) => api.post(`/plans/${planId}/submit`, {}, { params });
export const reviewPlan = (planId, decisionOrPayload, rejectReason) => {
  const payload = typeof decisionOrPayload === 'object'
    ? decisionOrPayload
    : { decision: decisionOrPayload, reject_reason: rejectReason };
  return api.post(`/plans/${planId}/review`, payload);
};
export const autoAssignPlan = (planId) => api.post(`/plans/${planId}/auto-assign`);
export const reviewBatchPlans = (data) => api.post(`/plans/review-batch`, data);
export const deletePlan = (planId, params = {}) => api.delete(`/plans/${planId}`, { params });
