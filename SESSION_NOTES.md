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
**Audit branch:** `codex/audit-fix-and-feature-completion` (merged into master via PRs #32 and #33)

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

### Completed

| # | Item | Details |
|---|------|---------|
| 1 | ~~**Open PR**~~ | ✅ **DONE (2026-03-14)** — PR created and merged into `master`. |
| 2 | ~~**SQL Server migration**~~ | ✅ **DONE (2026-03-14)** — Schema changes applied. |
| 3 | ~~**Production secrets**~~ | **DEFERRED by choice** — JWT secret and DB connection string intentionally left in `appsettings.json`. Revisit before production deployment. |
| 4 | ~~**Admin/Users UI**~~ | ✅ **DONE (2026-03-14)** — Full CRUD with search, dropdowns for dept/policy/manager. |
| 5 | ~~**Admin/Holidays UI**~~ | ✅ **DONE (2026-03-14)** — Year filter, create/edit/delete. |
| 6 | ~~**Notification bell**~~ | ✅ **DONE (2026-03-14)** — Bell in nav, 60s polling, unread badge, dismiss/mark-all. |
| 7 | ~~**CORS error**~~ | ✅ **FIXED (2026-03-14)** — Vite proxy `/api → https://localhost:7012`, `VITE_API_BASE=/api/v1`. |
| 8 | ~~**Admin/Projects CRUD**~~ | ✅ **DONE (2026-03-14)** — Upgraded from stub to full CRUD (create, edit, archive, delete). |
| 9 | ~~**Admin/Categories CRUD**~~ | ✅ **DONE (2026-03-14)** — Upgraded from stub to full CRUD (create, edit billable flag, delete). |

### Still To Do

### Medium Priority

| # | Item | Details |
|---|------|---------|
| 4 | ~~**Admin/Users UI component**~~ | ✅ **DONE (2026-03-14)** — `Admin/Users.tsx` built with search, create/edit form (role/dept/policy/manager dropdowns), activate/deactivate. |
| 5 | ~~**Holiday calendar UI**~~ | ✅ **DONE (2026-03-14)** — `Admin/Holidays.tsx` built with year filter, create/edit/delete. Wired into `App.tsx` admin nav. |
| 6 | ~~**Notification bell in nav**~~ | ✅ **DONE (prior session)** — `NotificationBell` component polls every 60s, shows unread badge, mark-read/mark-all-read dropdown. Already wired in `App.tsx` header. |

### Remaining Tasks (in priority order)

| # | Item | Details |
|---|------|---------|
| 1 | ~~**Holiday deduction in `GetWeek()`**~~ | ✅ **MERGED (2026-03-14)** — PR #32. |
| 2 | ~~**New integration tests**~~ | ✅ **MERGED (2026-03-14)** — PR #32. 52/52 backend tests pass. |
| 3 | ~~**Frontend component tests**~~ | ✅ **MERGED (2026-03-14)** — PR #33. 17/17 frontend tests pass. |
| 4 | ~~**UX overhaul & design system**~~ | ✅ **DONE (session 2, 2026-03-14)** — commit `6da1a37`. |

---

## Pending For Next Session

### ~~Priority 1 — Dashboard Redesign~~ ✅ DONE (session 3, 2026-03-15)
- Commit `c406d05`. Role-specific stat cards and tables for employee, manager, and admin.
- Employee: check-in time, attendance, weekly hours, status badge, compliance ratio, project effort table.
- Manager: team attendance, timesheet health, utilization, project contributions, mismatches.
- Admin: billable %, dept/project effort, per-user utilization with status badges.

### ~~Priority 1 — Professional UI/UX Redesign~~ ✅ DONE (sessions 4–5, 2026-03-15)

#### Round 1 — Color palette (commit `7f80b61`)
Warm editorial palette applied to tokens: gold `#c9a84c`, paper `#f5f3ef`, cream `#ede9e0`, ink `#0e0e0f`, rust `#c0522b`, sage `#5a7a5e`. Fonts: DM Serif Display + DM Sans.

#### Round 2 — Structural redesign "Chrono" (commit `a8254c8`)
Client rejected round 1 ("only color change, not a redesign"). Reference: `C:/Users/User/Downloads/timesheet-app_1.html`.
- **AppShell nav** — frosted glass (`rgba(245,243,239,0.85)` + `backdrop-filter: blur(12px)`), serif wordmark, animated 10px pulsing gold dot logo
- **Dashboard** — completely new layout structure for all 3 roles:
  - Eyebrow label (gold line `—` + uppercase gold text) + DM Serif Display h1 with italic gold username
  - Inline hero stats (serif number + uppercase muted label, no card boxes, separated by ink-line dividers)
  - `ActivityList` component: numbered rows (`01`, `02`…) with serif index, name+sub, status badge, serif value — replaces all `<table>` usage
  - Two-column layout: activity list left, chart/widget right
  - Manager: progress-bar list for project contributions
  - Admin: dept effort full-width + under/over + compliance trend side-by-side
- **AttendanceWidget** — dark ink timer widget: serif 2.4rem elapsed time, gold-tinted net strip, gold check-in / rust check-out buttons
- **Login** — cream left panel, serif italic headline, gold rule, bulleted feature list, gold CTA button

**Status: Awaiting manual testing feedback from client (session 5 end).**

### Priority 1 — UI/UX Fixes (next session)
- **Awaiting manual test results from client.** Client will test in browser and list issues/changes needed.
- Next session: apply all feedback from manual testing, then commit.

### Priority 2 — DB Table Verification (manual step)
Run in SSMS against local SQL Server — confirm all tables exist:
```sql
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME;
```
Expected tables: AuditLogs, Holidays, LeaveRequests, Notifications, Projects, RefreshTokens, TaskCategories, TimesheetEntries, Timesheets, UserRoles, Users, WorkSessions, BreakEntries.

### Priority 3 — Manual Smoke Test
- Login → check-in → timesheet entry (hh:mm format, Task Type) → submit → manager approve flow.
- Verify ProblemDetails returned on invalid input (`POST /auth/login` with empty body).
- Verify holiday endpoint (`GET /api/v1/holidays?year=2026`).
- Verify notification bell shows unread count after approval.

### ~~Priority 4 — Style Migration~~ ✅ DONE (session 3, 2026-03-15)
- Commit `ef31750`. Removed `<style>{timesheetStyles}</style>` from `Timesheets.tsx`.
- All `ts-*` rules now live in `design-system.css` with CSS variable references.
- `AttendanceWidget` `aw-*` styles were already in `styles.css` — no change needed.

---

## Session 2 — UX Overhaul & Design System (2026-03-14)

### What Was Done

#### Bug Fixes
- **RefreshTokens table missing** — added `CREATE TABLE RefreshTokens` to `db/schema.sql`; provided SSMS `IF NOT EXISTS` script.
- **AuditLogs table missing** — same fix; table found missing while monitoring API logs during manual testing.
- **Login rate limit 429** — raised `PermitLimit` from 10 → 100 per 15 minutes in `apps/api/Program.cs`.
- **Project dropdown empty for non-admin** — `TimesheetsController.GetEntryOptions()` and `CanWriteProject()` no longer filter by project membership; all active non-archived projects are now visible to all authenticated users.
- **UTC datetime timezone bug** — API returns datetimes without `Z` suffix; browser parsed them as local time. Fixed with `parseUtc()` helper in `AttendanceWidget.tsx` that appends `Z` when missing.

#### Task 3 — Timesheet Form Redesign
- Multi-entry rows (`EntryRow[]` state) — add/remove rows dynamically.
- `hh:mm` time format input with blur-validation via `parseHhMm()`.
- Task Type dropdown: Development, Testing, Design, Meeting, Support, Other.
- Running total bar with over-cap warning (compared against attendance minutes).
- Files: `apps/web/src/components/Timesheets.tsx` (complete rewrite)

#### Task 4 — AttendanceWidget
- New component: `apps/web/src/components/AttendanceWidget.tsx`
- Fetches `/attendance/summary/today` on mount; live elapsed timer via `setInterval`.
- Check In → `POST /attendance/check-in`; Check Out → `POST /attendance/check-out`.
- `onSummaryChange` callback prop for Timesheets cap integration.
- Placed at top of Dashboard.

#### Task 5 — Login Redesign
- Complete rewrite: split-panel layout (42% blue left panel, 58% white form panel).
- Fonts changed: DM Sans → Plus Jakarta Sans (display) + Inter (body) — updated `apps/web/index.html`.
- Features: show/hide password toggle, remember-me checkbox, fade-in animation, shimmer on hover.
- File: `apps/web/src/components/Login.tsx`

#### Design System
- **`apps/web/src/styles/design-system.css`** — 19 colour tokens, typography, spacing, shadows, full component class library.
- **`apps/web/src/components/AppShell.tsx`** — sticky 60px nav + 240px role-grouped sidebar; replaces flat header in App.tsx.
- Applied design system to all 11 pages: Approvals, Leave, Reports, Notifications, Projects, Categories, Users, Holidays, Dashboard, Login, Timesheets.
- **`apps/web/src/styles.css`** — all hardcoded values replaced with CSS variables.
- **`docs/DESIGN_SYSTEM.md`** + **`docs/DESIGN_SYSTEM_IMPLEMENTATION.md`** — reference docs.

#### Test Fixes
- Updated `Login.test.tsx`: new placeholder text (`"admin or admin@timesheet.local"`), button name `"Sign In"`, error shape uses `detail` field.
- Updated `App.test.tsx`: `findByText` → `findAllByText` to handle multiple "TimeSheet" elements in login split-panel.
- **All 17 frontend tests pass.**

#### Commit
- `6da1a37` on `master` — 25 files changed, 3,181 insertions, 551 deletions. Pushed to remote.

---

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
