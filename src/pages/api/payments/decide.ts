import { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { getClient } from '../../../lib/db';
import { logger } from '../../../lib/logger';
import { rateLimiter } from '../../../agent/rateLimiter';
import { runOrchestrator } from '../../../agent/orchestrator';
import { publishPaymentEvent } from '../../../agent/queue';
import { trackRequest } from '../metrics';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();
  const requestId = randomUUID();
  const log = (level: 'info' | 'error', message: string, context: any = {}) => {
      logger[level](message, { ...context, requestId });
  };

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { customerId, amount, currency, payeeId, idempotencyKey } = req.body;
  if (!customerId || !amount || !currency || !payeeId || !idempotencyKey) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (!rateLimiter.isAllowed(customerId)) {
    return res.status(429).json({ message: 'Too many requests' });
  }

  const client = await getClient();
  try {
    const idempotencyResult = await client.query(
      'SELECT response FROM idempotency_keys WHERE key = $1 AND customer_id = $2',
      [idempotencyKey, customerId]
    );

    if (idempotencyResult.rows.length > 0) {
      log('info', 'Idempotent request detected');
      return res.status(200).json(idempotencyResult.rows[0].response);
    }

    await client.query('BEGIN');
    
    const payeeExists = await client.query('SELECT id FROM customers WHERE id = $1', [payeeId]);
    if (payeeExists.rows.length === 0) {
      throw new Error('Payee not found');
    }

    const { decision, reasons, agentTrace } = await runOrchestrator({ customerId, amount }, client);

    if (decision === 'allow') {
        await client.query('UPDATE customers SET balance = balance - $1 WHERE id = $2', [amount, customerId]);
    }

    const response = { decision, reasons, agentTrace, requestId };
    
    await client.query(
        'INSERT INTO idempotency_keys (key, customer_id, response) VALUES ($1, $2, $3)',
        [idempotencyKey, customerId, JSON.stringify(response)]
    );

    await client.query('COMMIT');

    publishPaymentEvent({
      type: 'payment.decided',
      payload: { requestId, decision, customerId, amount },
    });

    log('info', 'Payment decision processed', { decision });
    res.status(200).json(response);
  } catch (error: any) {
    await client.query('ROLLBACK');
    log('error', 'Error processing payment', { error: error.message });
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    const latency = Date.now() - startTime;
    trackRequest(res.statusCode === 200 ? req.body.decision || 'allow' : 'block', latency);
    client.release();
  }
}
