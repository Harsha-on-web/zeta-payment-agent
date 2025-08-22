import { runOrchestrator } from '../src/agent/orchestrator';
import * as tools from '../src/agent/tools';
import { PoolClient } from 'pg';

jest.mock('../src/agent/tools', () => ({
  ...jest.requireActual('../src/agent/tools'),
  getTool: jest.fn(),
}));

describe('Orchestrator Decision Path', () => {
  it('should block a payment due to insufficient funds', async () => {
    const mockGetBalance = jest.fn().mockResolvedValue({ balance: 50, success: true });
    (tools.getTool as jest.Mock).mockImplementation((name: string) => {
        if (name === 'getBalance') {
            return { execute: mockGetBalance };
        }
        return undefined;
    });

    const client = {} as PoolClient; // Mock client
    const result = await runOrchestrator({ customerId: 'cust_123', amount: 100 }, client);

    expect(result.decision).toBe('block');
    expect(result.reasons).toContain('Insufficient funds.');
    expect(mockGetBalance).toHaveBeenCalledWith({ customerId: 'cust_123', client });
  });
});
