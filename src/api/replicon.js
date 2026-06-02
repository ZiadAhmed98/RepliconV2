import axios from 'axios';

// Leave this completely empty. 
// This forces Axios to use relative paths, letting the browser route traffic automatically.
const API_BASE_URL = ''; 

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