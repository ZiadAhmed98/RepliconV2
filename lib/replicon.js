import axios      from 'axios';
import { logger } from './helpers.js';

export function repliconHeaders() {
  return {
    Authorization:                `Bearer ${(process.env.REPLICON_TOKEN || '').trim()}`,
    'X-Replicon-Security-Context': 'User',
    'Content-Type':                'application/json',
  };
}

export function repliconBase() {
  return `https://ap1.replicon.com/${(process.env.REPLICON_COMPANY || '').trim()}/services`;
}

export async function wcfRequest(stepName, url, payload, headers) {
  logger.debug({ step: stepName, url }, 'WCF Request');
  try {
    const response = await axios.post(url, payload, { headers });
    logger.debug({ step: stepName }, 'WCF Success');
    return response.data;
  } catch (error) {
    logger.error({ step: stepName, status: error.response?.status, body: error.response?.data }, 'WCF Error');
    throw error;
  }
}
