import axios from 'axios';

// This hardcodes the bridge so your static React files know exactly where to send traffic
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://51.170.86.2:3000';

export const repliconApi = {
  login: async (username, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/login`, { username, password });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getDashboardData: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/dashboard?timestamp=` + new Date().getTime());
      return response.data;
    } catch (error) {
      throw new Error("Failed to fetch from backend. Ensure server.js is running.");
    }
  }
};