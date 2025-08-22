import { PoolClient } from 'pg';
import { getTool, Tool } from './tools';

interface AgentTrace {
  step: string;
  detail: string;
}

const executeToolWithRetries = async (
  tool: Tool,
  args: any,
  agentTrace: AgentTrace[],
  maxRetries = 2
) => {
  let attempts = 0;
  while (attempts <= maxRetries) {
    try {
      agentTrace.push({ step: 'Tool Call', detail: `Calling ${tool.name} (Attempt ${attempts + 1})` });
      const result = await tool.execute(args);
      if (result.success) {
        return result;
      }
      agentTrace.push({ step: 'Tool Error', detail: `Error in ${tool.name}: ${result.error}` });
    } catch (error: any) {
      agentTrace.push({ step: 'Tool Error', detail: `Exception in ${tool.name}: ${error.message}` });
    }
    attempts++;
  }
  return { success: false, error: `${tool.name} failed after ${maxRetries + 1} attempts.` };
}

export const runOrchestrator = async (
  { customerId, amount }: { customerId: string, amount: number },
  client: PoolClient
): Promise<{
  decision: 'allow' | 'review' | 'block';
  reasons: string[];
  agentTrace: AgentTrace[];
}> => {
  const agentTrace: AgentTrace[] = [];
  let decision: 'allow' | 'review' | 'block' = 'allow';
  const reasons: string[] = [];

  agentTrace.push({ step: 'Plan', detail: '1. Get balance. 2. Get risk signals. 3. Decide.' });

  const getBalanceTool = getTool('getBalance');
  if (getBalanceTool) {
    const balanceResult = await executeToolWithRetries(getBalanceTool, { customerId, client }, agentTrace);
    
    if (!balanceResult.success) {
      decision = 'block';
      reasons.push(balanceResult.error || 'Failed to get balance');
      agentTrace.push({ step: 'Tool Result', detail: `Error: ${balanceResult.error}` });
    } else {
      agentTrace.push({ step: 'Tool Result', detail: `Balance: ${balanceResult.balance}` });
      if (balanceResult.balance < amount) {
        decision = 'block';
        reasons.push('Insufficient funds.');
      }
    }
  }

  if (decision === 'allow') {
    const getRiskSignalsTool = getTool('getRiskSignals');
    if (getRiskSignalsTool) {
        const riskResult = await executeToolWithRetries(getRiskSignalsTool, { amount }, agentTrace);

        if (!riskResult.success) {
          decision = 'review';
          reasons.push(riskResult.error || 'Failed to get risk signals');
          agentTrace.push({ step: 'Tool Result', detail: `Error: ${riskResult.error}` });
        } else {
          agentTrace.push({ step: 'Tool Result', detail: `Risk: ${riskResult.risk}` });
          if (riskResult.risk === 'high') {
              decision = 'review';
              reasons.push('High risk transaction.');
          }
        }
    }
  }

  if (decision === 'review' || decision === 'block') {
      const createCaseTool = getTool('createCase');
      if (createCaseTool) {
          const caseResult = await executeToolWithRetries(createCaseTool, { customerId, amount, reason: reasons.join(', ') }, agentTrace);
          if (!caseResult.success) {
            agentTrace.push({ step: 'Tool Result', detail: `Error creating case: ${caseResult.error}` });
          } else {
            agentTrace.push({ step: 'Tool Result', detail: 'Case created.' });
          }
      }
  }

  return { decision, reasons, agentTrace };
};
