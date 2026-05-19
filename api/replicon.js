import axios from 'axios';

const client = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

export const repliconApi = {
    login: async (username, password) => {
        const response = await client.post('/login', { username, password });
        return response.data;
    },
    getDashboardData: async () => {
        const response = await client.get('/dashboard');
        return response.data;
    },
    submitProject: async (projectPayload) => {
        const response = await client.post('/projects/new', projectPayload);
        return response.data;
    },
    executeTimesheetAction: async (action, uris) => {
        const response = await client.post('/timesheets/action', { action, uris });
        return response.data;
    }
};