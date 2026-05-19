// src/api/replicon.js
import axios from 'axios';

export const repliconApi = {
  // 1. The Login Bridge
  login: async (username, password) => {
    try {
      const response = await axios.post('/api/login', { username, password });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 2. The Massive Dashboard Data Bridge
  getDashboardData: async () => {
    try {
      // We append a timestamp to prevent the browser from caching stale data
      const response = await axios.get('/api/dashboard?timestamp=' + new Date().getTime());
      return response.data;
    } catch (error) {
      throw new Error("Failed to fetch from backend. Ensure server.js is running.");
    }
  }
};