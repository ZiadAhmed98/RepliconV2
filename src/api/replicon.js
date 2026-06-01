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
      const timestamp = new Date().getTime();
      const requests = [
        axios.get(`${API_BASE_URL}/api/dashboard/dictionaries?t=${timestamp}`),
        axios.get(`${API_BASE_URL}/api/dashboard/cube?t=${timestamp}`),
        axios.get(`${API_BASE_URL}/api/dashboard/roster?t=${timestamp}`),
        axios.get(`${API_BASE_URL}/api/dashboard/drafts?t=${timestamp}`),
        axios.get(`${API_BASE_URL}/api/dashboard/timesheets?t=${timestamp}`)
      ];

      const [dictRes, cubeRes, rosterRes, draftsRes, timesheetsRes] = await Promise.all(requests);
      
      return {
        dictionaries: dictRes.data.dictionaries,
        accountManagers: dictRes.data.accountManagers,
        cube: cubeRes.data,
        roster: rosterRes.data,
        drafts: draftsRes.data,
        timesheets: timesheetsRes.data,
        tsDetails: []
      };
    } catch (error) {
      throw new Error("Failed to fetch from backend. Ensure server.js is running.");
    }
  }
};