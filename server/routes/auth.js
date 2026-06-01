import express from 'express';
import { config, getHeaders } from '../config.js';
import { wcfRequest } from '../services/repliconApi.js';

const router = express.Router();

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const lowerUsername = username.toLowerCase();

    if (!config.token || !config.company) {
        return res.status(500).json({ error: "Token / Company config error." });
    }

    if (!config.allowedUsers[lowerUsername] || config.allowedUsers[lowerUsername] !== password) {
        return res.status(401).json({ error: "Invalid credentials." });
    }

    try {
        const data = await wcfRequest(
            "User Login",
            `https://ap1.replicon.com/${config.company}/services/UserService1.svc/GetUser2`,
            { user: { loginName: config.repliconLogins[lowerUsername] } }, 
            getHeaders()
        );
        res.json({ success: true, displayName: data.d.displayName, uri: data.d.uri });
    } catch (error) { 
        res.status(400).json({ error: "Replicon rejected the user request." }); 
    }
});

export default router;
