import api from './api';

const routeDriverService = {
  getRouteDrivers: async (routeCode) => {
    const response = await api.get(`/routes/${routeCode}/drivers`);
    return response.data;
  },

  addDriverToRoute: async (routeCode, driverId) => {
    const response = await api.post(`/routes/${routeCode}/drivers`, { driver_id: driverId });
    return response.data;
  },

  removeDriverFromRoute: async (routeCode, driverId) => {
    const response = await api.delete(`/routes/${routeCode}/drivers/${driverId}`);
    return response.data;
  }
};

export default routeDriverService;
