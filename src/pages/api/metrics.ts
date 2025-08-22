import { NextApiRequest, NextApiResponse } from 'next';

const metrics = {
  totalRequests: 0,
  decisionCounts: {
    allow: 0,
    review: 0,
    block: 0,
  },
  // In a real app, you'd use a proper histogram for this.
  latencies: [] as number[], 
};

export const trackRequest = (decision: 'allow' | 'review' | 'block', latency: number) => {
    metrics.totalRequests++;
    metrics.decisionCounts[decision]++;
    metrics.latencies.push(latency);
    if (metrics.latencies.length > 1000) {
        metrics.latencies.shift(); // Keep the last 1000 latencies
    }
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const sortedLatencies = [...metrics.latencies].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedLatencies.length * 0.95);
  const p95Latency = sortedLatencies[p95Index] || 0;

  res.status(200).json({
    ...metrics,
    p95Latency,
  });
}
