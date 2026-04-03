# 10k Concurrent Users Readiness Plan (TimeSheet)

## Summary
Goal: make the .NET API + SQL Server + React system reliable for 10,000 concurrent users with predictable latency, controlled failure modes, and safe rollout.

Success criteria (production-like load test):
1. `GET` p95 < 400ms for core read APIs (`timesheet day/week`, `approvals list`).
2. `POST/PUT` p95 < 700ms for core write APIs (`upsert entry`, `submit`, `attendance check-in/out`).
3. Error rate < 1% during sustained 10k concurrency and < 3% during spike tests.
4. No lost updates on concurrent edits (verified by concurrency tests).
5. Export/notification workloads do not degrade interactive API latency.

Chosen defaults:
1. Phased hardening rollout.
2. Redis + queue + multi-instance deployment allowed.

## Implementation Changes (Decision-Complete)

### Phase 1: Immediate API and DB hardening
1. Add global rate limiting strategy in API:
- Keep existing login limiter.
- Add per-user and per-IP limiters for high-cost routes.
- Add stricter limiter for export endpoints.
- Standardize 429 response body with retry hint.

2. Add optimistic concurrency for timesheet writes:
- Add `rowversion` on `Timesheets` and `TimesheetEntries`.
- Update write commands to check concurrency token and return conflict (`409`) with refresh guidance.
- Add idempotency support for critical write operations (`upsert`, `submit`, `check-in/out`) using request key header.

3. Optimize hot queries/indexes:
- Add/verify composite indexes for common filters and order paths:
  - `Timesheets(UserId, WorkDate, Status)`
  - `TimesheetEntries(TimesheetId, ProjectId, TaskCategoryId)`
  - `Notifications(UserId, Type, IsRead, CreatedAtUtc DESC)`
  - `AuditLogs(CreatedAtUtc DESC, EntityType, ActorUserId)`
- Replace heavy include paths in hot read endpoints with projection queries where possible.

4. Add resilience policies:
- Introduce retry + timeout + circuit breaker for DB and external push paths.
- Ensure cancellation tokens are respected in repository and query layers.

### Phase 2: Distributed read scaling + async workload isolation
1. Add Redis distributed caching for read-heavy endpoints:
- Cache keys for day/week timesheet and approvals summary.
- Cache TTL defaults:
  - day/week timesheet: 30-60s
  - static options (projects/categories): 10-30m
- Invalidate cache on related writes (entry upsert/delete, submit, approval action, attendance changes affecting mismatches).

2. Move expensive synchronous operations to background queue:
- Export generation becomes async:
  - `POST /exports` creates job.
  - `GET /exports/{jobId}` returns status.
  - `GET /exports/{jobId}/download` returns file when complete.
- Notification dispatch uses queue + worker with retries and dead-letter support.

3. Add outbox pattern for reliable side effects:
- Transactionally record side effects in DB on write flows.
- Worker drains outbox and performs external sends/export finalization.

### Phase 3: Operability, scale-out, and rollout safety
1. Add full telemetry and SLOs:
- OpenTelemetry traces + metrics.
- Dashboard: request rate, error rate, duration (p50/p95/p99), queue depth, cache hit ratio, DB pool usage.
- Alerts for sustained p95 breach, 5xx spikes, queue backlog, cache outage fallback.

2. Prepare horizontal scaling:
- Ensure stateless API behavior for multi-instance.
- Configure readiness/liveness checks.
- Validate graceful shutdown and in-flight request draining.

3. Frontend traffic smoothing:
- Add request dedupe and stale-while-revalidate for repeated reads.
- Add retry with jitter for transient failures.
- Use conditional requests (`ETag`/`If-None-Match`) on suitable read endpoints.

## Public API / Interface / Type Changes
1. New headers:
- `Idempotency-Key` for critical write endpoints.
- Optional `ETag`/`If-None-Match` for read endpoints.

2. New/updated API contracts:
- Export endpoints become async job-based (`create/status/download`).
- Conflict responses (`409`) include machine-readable reason `concurrency_conflict`.

3. Internal interfaces:
- Introduce cache abstraction for hot reads (for example, timesheet/approvals query service).
- Introduce queue publisher/consumer interfaces for exports and notifications.
- Introduce outbox service interface for transactional side effects.

4. Data model additions:
- `rowversion` columns on timesheet tables.
- Export jobs table.
- Outbox table and dead-letter table (or equivalent queue metadata store).

## Test Plan (Must Pass Before Rollout)
1. Unit tests:
- Concurrency token mismatch returns `409`.
- Idempotency prevents duplicate writes.
- Cache key generation/invalidation correctness.
- Queue retry/dead-letter behavior.

2. Integration tests:
- Concurrent edits on same timesheet/day produce no lost updates.
- Cached reads reflect updates after invalidation.
- Export job lifecycle works under high parallel submissions.
- Outbox guarantees eventual notification/export side effect.

3. Performance/load tests:
- 10k virtual users mixed profile:
  - 70% reads (day/week/options/approvals)
  - 20% writes (entry upsert/submit/attendance)
  - 10% auth/notifications/export triggers
- Spike and soak tests:
  - 2x spike for 5 minutes
  - 2-hour sustained load
- Capture p95/p99, error rate, queue lag, cache hit ratio, DB CPU/locks/waits.

4. Failure-mode tests:
- Redis unavailable: API remains functional with degraded latency.
- Queue unavailable: interactive API still succeeds; backlog recovers after restore.
- One API instance down: no user-visible outage beyond transient retries.

## Assumptions and Defaults
1. SQL Server remains primary transactional store.
2. Redis is available as distributed cache.
3. Background processing can run in separate worker process/service.
4. Multi-instance deployment behind load balancer is available.
5. Core focus is scalability/reliability; no major business-rule changes except async export contract and conflict handling.
