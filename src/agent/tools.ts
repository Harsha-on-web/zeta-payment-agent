import { PoolClient } from 'pg';

export interface Tool {
  name: string;
  description: string;
  execute: (args: any) => Promise<any>;
}

export const tools: Tool[] = [
  {
    name: 'getBalance',
    description: 'Get the balance for a customer.',
    execute: async ({ customerId, client }: { customerId: string, client: PoolClient }) => {
      try {
        const res = await client.query('SELECT balance FROM customers WHERE id = $1', [customerId]);
        if (res.rows.length === 0) {
          return { success: false, error: 'Customer not found' };
        }
        return { balance: res.rows[0].balance, success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  },
  {
    name: 'getRiskSignals',
    description: 'Get risk signals for a payment.',
    execute: async ({ amount }: { amount: number }) => {
      // In a real scenario, this could fail.
      if (amount > 1000) {
        return { risk: 'high', success: true };
      }
      return { risk: 'low', success: true };
    },
  },
  {
    name: 'createCase',
    description: 'Create a case for review.',
    execute: async ({ customerId, amount, reason }: { customerId: string, amount: number, reason: string }) => {
      // In a real scenario, this could fail.
      console.log(`Creating case for customer ${customerId} for amount ${amount} due to ${reason}`);
      return { caseId: `case_${Date.now()}`, success: true };
    },
  },
];

export const getTool = (name: string): Tool | undefined => {
  return tools.find((tool) => tool.name === name);
};
