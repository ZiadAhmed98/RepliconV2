import 'dotenv/config';

export const config = {
    token: (process.env.REPLICON_TOKEN || "").trim(),
    company: (process.env.REPLICON_COMPANY || "").trim(),
    port: process.env.PORT || 3000,
    allowedUsers: { 
        "ziad": process.env.AdminPWD, 
        "mod": process.env.ModPWD, 
        "gm": process.env.GMPWD 
    },
    repliconLogins: { 
        "ziad": "z.shafik", 
        "mod": "i.najmi", 
        "gm": "H.matta" 
    }
};

export const getHeaders = () => {
    return { 
        'Authorization': `Bearer ${config.token}`, 
        'X-Replicon-Security-Context': 'User', 
        'Content-Type': 'application/json' 
    };
};
