import { rateLimiter } from '../src/agent/rateLimiter';

describe('rateLimiter', () => {
  it('should allow requests within the limit', () => {
    const customerId = 'test-customer';
    for (let i = 0; i < 5; i++) {
      expect(rateLimiter.isAllowed(customerId)).toBe(true);
    }
  });

  it('should block requests exceeding the limit', () => {
    const customerId = 'test-customer-2';
    for (let i = 0; i < 5; i++) {
      rateLimiter.isAllowed(customerId);
    }
    expect(rateLimiter.isAllowed(customerId)).toBe(false);
  });

  it('should reset tokens after the time window', async () => {
    const customerId = 'test-customer-3';
    for (let i = 0; i < 5; i++) {
      rateLimiter.isAllowed(customerId);
    }
    expect(rateLimiter.isAllowed(customerId)).toBe(false);

    // Wait for the window to pass
    await new Promise((resolve) => setTimeout(resolve, 1001));

    expect(rateLimiter.isAllowed(customerId)).toBe(true);
  });
});
