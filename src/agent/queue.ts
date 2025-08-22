interface PaymentEvent {
  type: 'payment.decided';
  payload: {
    requestId: string;
    decision: 'allow' | 'review' | 'block';
    customerId: string;
    amount: number;
  };
}

const eventQueue: PaymentEvent[] = [];

export const publishPaymentEvent = (event: PaymentEvent) => {
  console.log(`Publishing event: ${event.type}`, event.payload);
  eventQueue.push(event);
};

export const getQueueContents = (): PaymentEvent[] => {
  return [...eventQueue];
};
