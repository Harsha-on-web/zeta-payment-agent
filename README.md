# PayNow + Agent Assist Backend

This is a minimal, production-minded backend for the "PayNow + Agent Assist" challenge. It's built with Next.js API routes (TypeScript), connects to PostgreSQL using the raw `pg` package, and uses an in-memory queue for event publishing.

## Architecture

```
+-----------------+      +---------------------+      +----------------+
|   API Gateway   |----->| Next.js API Routes  |----->| Agent Service  |
+-----------------+      | (decide, metrics)   |      +----------------+
                         +---------------------+               |
                               |  |                            |
                               |  +----------------------------+
                               |
                 +-------------v-------------+
                 |    PostgreSQL (pg lib)    |
                 +---------------------------+
```

## Local Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Set up environment variables:**
    Copy `.env.example` to `.env` and fill in your database details.
    ```bash
    cp .env.example .env
    ```
3.  **Run the database migrations (schema):**
    You'll need a `psql` client for this.
    ```sql
    CREATE TABLE customers (
        id VARCHAR(255) PRIMARY KEY,
        balance INT NOT NULL
    );

    CREATE TABLE idempotency_keys (
        key VARCHAR(255) PRIMARY KEY,
        customer_id VARCHAR(255) NOT NULL,
        response JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

## API Usage

### `/api/payments/decide`

**Request:**

```bash
curl -X POST http://localhost:3000/api/payments/decide \
-H "Content-Type: application/json" \
-H "X-API-Key: your-secret-api-key" \
-d '{
  "customerId": "cust_123",
  "amount": 100,
  "currency": "USD",
  "payeeId": "payee_456",
  "idempotencyKey": "some-unique-key-for-this-payment"
}'
```

**Response:**

```json
{
  "decision": "allow",
  "reasons": [],
  "agentTrace": [
    { "step": "Plan", "detail": "1. Get balance. 2. Get risk signals. 3. Decide." },
    { "step": "Tool Call", "detail": "Calling getBalance tool." },
    { "step": "Tool Result", "detail": "Balance: 500" },
    { "step": "Tool Call", "detail": "Calling getRiskSignals tool." },
    { "step": "Tool Result", "detail": "Risk: low" }
  ],
  "requestId": "some-random-uuid"
}
```

## Design Notes

*   **Agent Logic**: The agent is deterministic and follows a hardcoded plan. This ensures predictability and testability. It uses a simple tool-based architecture.
*   **Logging**: Logs are structured JSON, with `customerId` redacted.
*   **Observability**: A basic `/api/metrics` endpoint is exposed, providing request counts, decision distribution, and p95 latency.
*   **Tradeoffs**:
    *   **Performance**: The in-memory rate limiter and queue are fast but not durable. In a production system, you'd use Redis or a similar external service.
    *   **Security**: API key authentication is simple. In a real-world scenario, you'd use a more robust system like OAuth2.
    *   **Scalability**: The current setup runs on a single node. For a larger scale, you'd need a distributed rate limiter and a proper message broker like Kafka or RabbitMQ.
