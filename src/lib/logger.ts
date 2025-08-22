import { NextApiRequest } from 'next';

const REDACTED_FIELDS = ['customerId'];

const redact = (data: any): any => {
  if (!data) {
    return data;
  }
  if (typeof data !== 'object') {
    return data;
  }

  const redactedData = { ...data };
  for (const field of REDACTED_FIELDS) {
    if (redactedData[field]) {
      redactedData[field] = 'REDACTED';
    }
  }
  return redactedData;
};

export const logger = {
  info: (message: string, context: Record<string, any> = {}) => {
    const requestId = context.requestId || 'unknown';
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      requestId,
      message,
      ...redact(context),
    }));
  },
  error: (message: string, error: Error, context: Record<string, any> = {}) => {
    const requestId = context.requestId || 'unknown';
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      requestId,
      message,
      error: error.message,
      stack: error.stack,
      ...redact(context),
    }));
  },
};
