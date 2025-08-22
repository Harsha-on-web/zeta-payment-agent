const tokens = new Map<string, number>();
const timestamps = new Map<string, number>();
const MAX_REQUESTS = 5;
const TIME_WINDOW = 1000; // 1 second in milliseconds

export const rateLimiter = {
  isAllowed: (customerId: string): boolean => {
    const now = Date.now();
    const lastRequestTime = timestamps.get(customerId) || 0;
    const tokensForCustomer = tokens.get(customerId) || MAX_REQUESTS;

    if (now - lastRequestTime > TIME_WINDOW) {
      tokens.set(customerId, MAX_REQUESTS - 1);
      timestamps.set(customerId, now);
      return true;
    }

    if (tokensForCustomer > 0) {
      tokens.set(customerId, tokensForCustomer - 1);
      timestamps.set(customerId, now);
      return true;
    }

    return false;
  },
};
