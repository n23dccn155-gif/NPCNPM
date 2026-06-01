import api from './api';

export const getPlans = (params) => api.get('/plans', { params });
export const getPlan = (id) => api.get(`/plans/${id}`);
export const createPlan = (data) => api.post('/plans', data);
export const generateTrips = (planId) => api.post(`/plans/${planId}/generate-trips`);
export const submitPlan = (planId) => api.post(`/plans/${planId}/submit`);
export const reviewPlan = (planId, decisionOrPayload, rejectReason) => {
  const payload = typeof decisionOrPayload === 'object'
    ? decisionOrPayload
    : { decision: decisionOrPayload, reject_reason: rejectReason };
  return api.post(`/plans/${planId}/review`, payload);
};
