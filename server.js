import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { config } from './server/config.js';

import authRoutes from './server/routes/auth.js';
import dashboardRoutes from './server/routes/dashboard.js';
import projectRoutes from './server/routes/projects.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({
    origin: ['http://129.151.146.210', 'http://localhost'],
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json()); 

// API Routes
app.use('/api', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/projects', projectRoutes);

// Static file serving
app.use(express.static(path.join(__dirname, 'dist'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
        else if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
    }
}));

// Fallback for React Router
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: "API route not found" });
    res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(config.port, '0.0.0.0', () => console.log(`Server running on port ${config.port}`));