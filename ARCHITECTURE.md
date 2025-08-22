## PayNow + Agent Assist: Architecture, Security, Observability, and Trade‑offs

### Scope
- Covers: performance (incl. p95), security/auth, PII handling, observability/metrics, agent design/retries, idempotency/concurrency, rate limiting, events, and key trade‑offs.
- Excludes app usage/setup (see README).

### Performance
- Request lifecycle: Next.js API route → validation → rate limit → idempotency lookup → agent orchestration → optional balance update in transaction → persist idempotent response → enqueue event → respond.
- p95 latency: tracked in-memory in `/api/metrics` by pushing per-request latency and computing p95 over the last ~1000 samples. This is approximate and non-distributed.
- DB efficiency:
  - `pg` pool is reused; single connection per request for critical section.
  - Balance check and mutation use straightforward SQL. Reservation is simulated by `UPDATE ... SET balance = balance - $1` within an explicit `BEGIN/COMMIT`.
- In-memory fast path: rate limiter and event queue are in-process for minimal overhead.

### p95 Latency Details
- Collection: push latency (ms) per request in memory; p95 = element at index `floor(n*0.95)` of sorted window.
- Caveats: not histogram-based, not percentiles per route, not persistent, resets on process restart, and not accurate under multi-instance deployments.

### Security & Auth
- API authentication: required `X-API-Key` header checked against `process.env.API_KEY`. Missing/invalid → 401.
- Input validation: presence checks on `customerId`, `amount`, `currency`, `payeeId`, `idempotencyKey`. Type/shape kept minimal by design for simplicity.
- DB access: `pg` with parameterized queries only (no string interpolation) to mitigate SQL injection.
- Secrets: loaded from environment; no secrets committed in repo; `.env.example` provided.

### PII Handling
- Logging: central JSON logger includes `requestId` and redacts sensitive identifiers (e.g., `customerId`) from structured contexts.
- Policy: avoid logging raw PII in application logs; only structured logs with redaction. Prefer operational metadata (requestId, decision, timings).
- Future: extend redaction list for more fields; route all logs through the central logger.

### Observability
- RequestId: every request tagged with `requestId` (UUID) and propagated in logs.
- Metrics endpoint `/api/metrics` reports:
  - `totalRequests`
  - decision counts by type (allow/review/block)
  - rough `p95Latency` (derived in-memory from recent samples)
- Event visibility: in-memory event queue function logs published events for quick introspection.

### Agent Design
- Deterministic tool-based orchestrator:
  - Plan: get balance → get risk signals → decide → optionally create case.
  - Tools: `getBalance` (DB), `getRiskSignals` (stubbed), `createCase` (stubbed).
- Retries/guardrails:
  - Each tool call is executed via a wrapper with up to 2 retries (3 attempts total).
  - Failures in `getBalance` → block; failures in `getRiskSignals` → review. `createCase` failure is recorded in trace but does not fail the request.
- Agent trace: step-by-step trace with plan, each tool attempt, results/errors to aid debugging and auditability.

### Idempotency & Concurrency
- Rule: a `(customerId, idempotencyKey)` pair returns the same response for repeats.
- Storage: `idempotency_keys` table stores the serialized response.
- Flow:
  1) Lookup by `(key, customer_id)`; if found → return stored response.
  2) Otherwise, process decision. On success, store response and commit.
- Trade-off: simple select-then-insert pattern can race under high concurrency. A more robust pattern is `INSERT ... ON CONFLICT (key, customer_id) DO NOTHING RETURNING *` and/or storing a processing marker; on conflict, return existing response.

### Rate Limiting
- Token-bucket style, in-memory per-`customerId`: 5 requests/second/customer.
- Fast, low overhead; resets on restart and not shared across instances.
- For multi-instance: move to Redis or a distributed rate limiter.

### Event Publishing
- On any decision, publishes `payment.decided` to an in-memory queue (Kafka-like simulation).
- Queue is process-local; suitable for demos and tests. For production, use Kafka/RabbitMQ and add delivery guarantees, retries, and dead-lettering.

### Error Handling
- Centralized try/catch in API handler with `ROLLBACK` on errors.
- Tool calls report `{ success: boolean, error?: string }` and are retried with bounded attempts; orchestrator maps failures to safe outcomes (review/block).
- Logs include error messages and stack traces (no PII).

### Known Limitations & Trade‑offs
- In-memory components (rate limiter, queue, metrics latencies) are non-durable and single-instance only.
- p95 approximation is naive; lacks histograms, labels, and multi-instance aggregation.
- Idempotency flow can race under high concurrency; consider an atomic `INSERT ... ON CONFLICT` pattern with status fields.
- API key auth is simple; for larger systems consider OAuth2/JWT and per-key quotas/permissions.
- Risk engine is stubbed/deterministic by design; replace with real signals and scoring when available.
- Logging redaction list is minimal; extend as data surface grows and enforce structured logging everywhere.

### Suggested Next Steps
- Move rate limiting and event queue to Redis/Kafka.
- Adopt Prometheus/OpenTelemetry for metrics/tracing; instrument p95 with histograms.
- Harden idempotency with atomic upserts and processing states.
- Expand validation (types/ranges/currency codes) and add schema-level constraints.
- Enforce log redaction with centralized wrappers and linters.
