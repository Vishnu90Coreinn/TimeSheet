# TimeSheet — Session Notes

> **IMPORTANT FOR AI ASSISTANTS:** Read this file at the start of every new session to get full context on what has been done and what still needs to be completed. Do not repeat work that is already marked done. Pick up from the "What Is Left To Complete" section.

---

## Project Overview

**TimeSheet Management System** — ASP.NET Core 10 Web API + React 18/Vite/TypeScript SPA.

| Layer | Tech |
|-------|------|
| API | ASP.NET Core 10, EF Core 9, SQL Server, JWT Bearer, Serilog |
| Tests | xUnit, `WebApplicationFactory<Program>`, EF Core InMemory |
| Frontend | React 18, Vite, TypeScript, Vitest |
| DB | SQL Server (local dev), InMemory (tests) |

**Repository:** https://github.com/Vishnu90Coreinn/TimeSheet
**Main branch:** `master`
**Audit branch:** `codex/audit-fix-and-feature-completion` (pushed, PR not yet opened)

---

## Session 1 — Audit, Fix & Feature Completion (2026-03-14)

### What Was Done

#### Phase 1 — Audit
- Reviewed the full codebase against `PROJECT_TASKS.md`.
- Found **35 findings**: security vulnerabilities, false-DONE tasks (Notifications, Holidays, Audit Logging were never implemented), N+1 query bugs, hardcoded values, monolithic frontend.
- Rewrote `PROJECT_TASKS.md` with a Phase 1 Audit Findings table and Phase 2 Fix Tasks block.

#### Phase 2 — Security & Config
- CORS origins moved to `appsettings.json` `Cors:AllowedOrigins` array.
- Rate limiting on `POST /auth/login` — 10 requests per 15 minutes per IP (ASP.NET Core built-in `AddRateLimiter`, fixed-window).
- JWT role sourced exclusively from `UserRoles` join table — removed `?? user.Role` string fallback in `AuthController`.
- Production startup guard: throws if JWT key equals the placeholder value.
- `DashboardController.Management()` uses `[Authorize(Roles="admin")]` instead of manual `if (role != "admin")` check.
- `RefreshTokenCleanupService` background job — runs daily at 02:00 UTC, deletes expired/revoked refresh tokens via `ExecuteDeleteAsync`.

#### Phase 3 — Error Handling & Observability
- Global exception handler using `UseExceptionHandler` — returns RFC 7807 `ProblemDetails` JSON with `traceId` on all unhandled exceptions.
- `CorrelationIdMiddleware` — reads/generates `X-Correlation-ID` header, pushes to Serilog `LogContext`.
- Serilog structured logging configured in `Program.cs` with console sink.

#### Phase 4 — Request Validation
- `[Required]`, `[MaxLength]`, `[EmailAddress]`, `[Range]`, `[MinLength]` DataAnnotations added to all 10 DTO files in `apps/api/Dtos/`.

#### Phase 5 — Missing Features
- **Notification system:**
  - `apps/api/Models/Notification.cs` — `NotificationType` enum + `Notification` entity.
  - `apps/api/Services/NotificationService.cs` — `INotificationService`/`NotificationService`.
  - `apps/api/Controllers/NotificationsController.cs` — `GET /api/v1/notifications`, `PUT /{id}/read`, `PUT /read-all`.
  - `apps/api/Services/NotificationSchedulerService.cs` — `BackgroundService`, runs daily at 06:00 UTC: missing checkout, missing timesheet, pending approvals reminders.
  - Notification triggers added to `ApprovalsController` and `LeaveController` on status change.
- **Holiday calendar:**
  - `apps/api/Models/Holiday.cs` — `Id`, `Name`, `Date`, `IsRecurring`, `CreatedAtUtc`.
  - `apps/api/Controllers/HolidaysController.cs` — admin CRUD + public `GET /api/v1/holidays?year=`.
  - `apps/api/Data/DbInitializer.cs` — 5 seed holidays for 2026.
  - `apps/api/Dtos/HolidayDtos.cs`.
- **Audit logging:**
  - `apps/api/Services/AuditService.cs` — `IAuditService`/`AuditService` with `WriteAsync`. Does NOT call `SaveChangesAsync` itself.
  - `UsersController` — replaced inline `WriteAuditLogAsync` with `IAuditService`.
  - `TimesheetsController` — audit on UpsertEntry, DeleteEntry, Submit.
  - `ApprovalsController` — audit on Decide (Approve/Reject/PushBack).
  - `LeaveController` — audit on ApplyLeave and ReviewLeave.

#### Phase 6 & 7 — Performance & DB Indexes
- Fixed N+1 in `TimesheetsController.GetWeek()`: 21 individual queries → 3 bulk queries (timesheets+entries, sessions+breaks, leaves) assembled in-memory.
- Fixed N+1 in `ReportsController.LeaveAndUtilization()`: per-user loop → 2 grouped aggregate queries (`GROUP BY UserId, IsHalfDay` for leave, `GROUP BY UserId` for timesheet minutes).
- `IsBillable` bool column added to `TaskCategory` model + DTO — replaces fragile `name.Contains("bill")` substring detection in `DashboardController`.
- `HasIndex()` fluent config added to `TimeSheetDbContext` for: `WorkSession(UserId)`, `WorkSession(Status)`, `Timesheet(UserId)`, `Timesheet(WorkDate)`, `TimesheetEntry(ProjectId)`, `LeaveRequest(UserId)`.
- `db/schema.sql` updated: new tables `Notifications`, `Holidays`; `ALTER TABLE TaskCategories ADD IsBillable`; all indexes.

#### Phase 8 — Frontend Refactor
- Monolithic `apps/web/src/App.tsx` (193 lines, all logic in one file) split into:
  - `apps/web/src/types.ts` — all shared TypeScript interfaces.
  - `apps/web/src/api/client.ts` — `apiFetch` with JWT auth headers + 401 → refresh token interceptor.
  - `apps/web/src/hooks/useSession.ts` — restores session from localStorage, calls `GET /auth/me` to verify role server-side.
  - `apps/web/src/components/Login.tsx`
  - `apps/web/src/components/Dashboard.tsx`
  - `apps/web/src/components/Timesheets.tsx`
  - `apps/web/src/components/Leave.tsx` — inline comment form (no `window.prompt()`).
  - `apps/web/src/components/Approvals.tsx` — inline comment form (no `window.prompt()`).
  - `apps/web/src/components/Reports.tsx`
  - `apps/web/src/components/Notifications.tsx`
  - `apps/web/src/components/Admin/Projects.tsx`
  - `apps/web/src/components/Admin/Categories.tsx`
  - `apps/web/src/App.tsx` — reduced to ~60-line routing shell.
- `apps/web/.env.development` — `VITE_API_BASE=http://localhost:5000/api/v1`.
- `apps/web/.env.production.example` — documentation template.
- `apps/web/vite.config.ts` — added Vitest config (`jsdom` environment).

#### Phase 9 — Tests & CI
- Fixed `CustomWebApplicationFactory.cs` for EF Core 9 dual-provider conflict.
  - **Root cause:** `AddDbContext` in `Program.cs` registers `IDbContextOptionsConfiguration<TimeSheetDbContext>` with SQL Server. Test factory called `AddDbContext` again with InMemory → both providers registered → EF Core 9 throws.
  - **Fix:** Remove descriptors where `d.ServiceType.IsGenericType && d.ServiceType.Name.StartsWith("IDbContextOptionsConfiguration") && d.ServiceType.GenericTypeArguments[0] == typeof(TimeSheetDbContext)` before adding InMemory.
- Updated both `.csproj` files to `net10.0` (machine only has .NET 10 runtime).
- EF Core packages → `9.0.0`, Serilog.AspNetCore → `9.0.0`.
- **35/35 backend integration tests pass.**
- **7/7 frontend Vitest tests pass.**
- **Frontend build:** zero TypeScript errors, 160 KB JS bundle.

### Commit
- Branch: `codex/audit-fix-and-feature-completion`
- Commit: `d59d45b` — 57 files changed, 1,798 insertions, 342 deletions.

---

## What Is Left To Complete

Work the following items in order of priority. Update this file and push to master after each session.

### High Priority

| # | Item | Details |
|---|------|---------|
| 1 | ~~**Open PR**~~ | ✅ **DONE (2026-03-14)** — PR created and merged into `master`. Branch `codex/audit-fix-and-feature-completion` is merged. |
| 2 | ~~**SQL Server migration**~~ | ✅ **DONE (2026-03-14)** — Schema changes applied. |
| 3 | ~~**Production secrets**~~ | **DEFERRED by choice** — JWT secret and DB connection string intentionally left in `appsettings.json` for now. Revisit before production deployment. |

### Medium Priority

| # | Item | Details |
|---|------|---------|
| 4 | **Admin/Users UI component** | `apps/web/src/components/Admin/Users.tsx` was NOT created. Admin user management (create/edit/deactivate users) still lives inline — needs its own component following the same pattern as `Projects.tsx` and `Categories.tsx`. |
| 5 | **Holiday calendar UI** | `HolidaysController` API exists and is tested, but no UI component was built for viewing or managing holidays. Add `apps/web/src/components/Admin/Holidays.tsx` and wire into `App.tsx` nav under Admin section. |
| 6 | **Notification bell in nav** | `Notifications.tsx` component exists, but the nav bell icon with unread count badge and dropdown has NOT been wired into `App.tsx` nav bar. Add polling every 60 seconds and a badge showing unread count. |

### Low Priority

| # | Item | Details |
|---|------|---------|
| 7 | **Holiday integration into expected hours** | `HolidaysController` exists, but `TimesheetsController.GetDay()` / `GetWeek()` do NOT yet subtract approved holidays from expected work hours. Add a query for holidays on the requested date range and reduce `expectedMinutes` accordingly. |
| 8 | **New integration tests** | `NotificationsIntegrationTests.cs`, `HolidaysIntegrationTests.cs`, `ReportsIntegrationTests.cs`, `DashboardIntegrationTests.cs` are not yet written. Existing 35 tests cover auth, timesheets, leave, approvals. |
| 9 | **Frontend component tests** | Only `App.test.tsx` exists. Add Vitest component tests for `Login.tsx`, `Timesheets.tsx`, `Approvals.tsx` with `vi.mock('../api/client')`. |
| 10 | **Manual smoke test** | Run full end-to-end flow: login → check-in → timesheet entry → submit → manager approve. Verify: ProblemDetails on bad input, rate limit 429 after 10 login attempts, notification sent on approval, holiday at `GET /api/v1/holidays?year=2026`. |

---

## Key File Locations

```
apps/api/
├── Controllers/
│   ├── AuthController.cs          — login (rate limited), refresh, me
│   ├── TimesheetsController.cs    — week view (N+1 fixed), audit logging
│   ├── ReportsController.cs       — 4 report types (N+1 fixed)
│   ├── ApprovalsController.cs     — approve/reject/pushback + audit + notify
│   ├── LeaveController.cs         — apply/review + audit + notify
│   ├── DashboardController.cs     — employee/manager/management (IsBillable)
│   ├── NotificationsController.cs — NEW: unread, mark-read, mark-all-read
│   ├── HolidaysController.cs      — NEW: CRUD + public year query
│   ├── UsersController.cs         — CRUD + AuditService
│   └── TaskCategoriesController.cs — CRUD + IsBillable
├── Services/
│   ├── AuditService.cs            — NEW: IAuditService/AuditService
│   ├── NotificationService.cs     — NEW: INotificationService/NotificationService
│   ├── NotificationSchedulerService.cs — NEW: daily background job
│   └── RefreshTokenCleanupService.cs   — NEW: daily token cleanup
├── Middleware/
│   └── CorrelationIdMiddleware.cs — NEW: X-Correlation-ID header
├── Models/
│   ├── Notification.cs            — NEW
│   ├── Holiday.cs                 — NEW
│   └── TaskCategory.cs            — UPDATED: added IsBillable
├── Data/
│   ├── TimeSheetDbContext.cs      — UPDATED: new DbSets, HasIndex calls
│   └── DbInitializer.cs           — UPDATED: IsBillable seeds, holiday seeds
├── Dtos/                          — ALL 10 files updated with DataAnnotations
├── Program.cs                     — UPDATED: Serilog, rate limiting, CORS, ProblemDetails
└── appsettings.json               — UPDATED: Cors:AllowedOrigins section

apps/web/src/
├── api/client.ts                  — NEW: fetch wrapper + refresh interceptor
├── hooks/useSession.ts            — NEW: session restore + server role verify
├── types.ts                       — NEW: shared TypeScript types
├── components/
│   ├── Login.tsx                  — NEW
│   ├── Dashboard.tsx              — NEW
│   ├── Timesheets.tsx             — NEW
│   ├── Leave.tsx                  — NEW (inline comment form)
│   ├── Approvals.tsx              — NEW (inline comment form)
│   ├── Reports.tsx                — NEW
│   ├── Notifications.tsx          — NEW (component only, NOT wired to nav bell yet)
│   └── Admin/
│       ├── Projects.tsx           — NEW
│       └── Categories.tsx         — NEW
│       (Users.tsx MISSING — not yet created)
│       (Holidays.tsx MISSING — not yet created)
└── App.tsx                        — UPDATED: routing shell ~60 lines

apps/api.tests/
├── CustomWebApplicationFactory.cs — FIXED: EF Core 9 dual-provider conflict
└── TimeSheet.Api.Tests.csproj     — UPDATED: net10.0, EF Core 9.0.0

db/schema.sql                      — UPDATED: new tables, indexes, IsBillable column
PROJECT_TASKS.md                   — UPDATED: audit findings + Phase 2 task list
```

---

## Known Issues / Gotchas

- **EF Core 9 dual-provider in tests:** The fix in `CustomWebApplicationFactory.cs` removes `IDbContextOptionsConfiguration<TimeSheetDbContext>` service descriptors by name match (`d.ServiceType.Name.StartsWith("IDbContextOptionsConfiguration")`). Do not revert this — it will break all 35 tests.
- **net10.0 only:** The dev machine only has .NET 10 runtime installed, not .NET 8. Both `.csproj` files target `net10.0`. Do not downgrade.
- **`gh` CLI not installed:** GitHub CLI (`gh`) is not available on this machine. All GitHub operations (PR creation, etc.) must be done via browser or by installing `gh`.
- **RefreshTokenCleanupService uses `ExecuteDeleteAsync`:** This is an EF Core 7+ bulk delete. Requires SQL Server provider in production (InMemory does not support it — the service uses try/catch to swallow the InMemory error).
- **`AuditService.WriteAsync` does NOT call `SaveChangesAsync`:** The caller is responsible. This is intentional so audit log entries are part of the same transaction as the main entity change.
