import axios from 'axios';
import { config } from '../config.js';

export async function wcfRequest(stepName, url, payload, headers) {
    console.log(`\n========================================================`);
    console.log(`[>> REPLICON API REQUEST >>] ${stepName}`);
    console.log(`URL: ${url}`);
    // console.log(`PAYLOAD:\n${JSON.stringify(payload, null, 2)}`); // Un-comment for deep WCF debugging
    console.log(`--------------------------------------------------------`);
    try {
        const response = await axios.post(url, payload, { headers });
        console.log(`[<< REPLICON API SUCCESS <<] ${stepName} - 200 OK`);
        console.log(`========================================================\n`);
        return response.data;
    } catch (error) {
        console.error(`\n❌ [XX REPLICON API ERROR XX] ${stepName} FAILED!`);
        console.error(`URL: ${url}`);
        if (error.response) {
            console.error(`STATUS: ${error.response.status} ${error.response.statusText}`);
            console.error(`ERROR RESPONSE JSON:\n${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(`ERROR MESSAGE: ${error.message}`);
        }
        console.error(`========================================================\n`);
        throw error;
    }
}
