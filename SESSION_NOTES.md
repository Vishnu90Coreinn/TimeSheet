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

### ~~Priority 1 — Pulse SaaS Redesign~~ ✅ DONE (session 6, 2026-03-16)

Commit `db9345d`. Complete visual overhaul from "Chrono editorial" to "Pulse SaaS":
- **design-system.css v2.0** — indigo brand palette (`--brand-*`), full neutral scale (`--n-0`..`--n-900`), Bricolage Grotesque display + Plus Jakarta Sans body. All new stat-card, badge, tab, shell-layout classes.
- **AppShell v3** — breadcrumb topbar; sidebar with brand header + org-switcher, user section, grouped nav (`nav-item`/`nav-section`)
- **Dashboard** — stat cards, bar charts, donut charts, activity feeds, compliance calendars for all 3 roles
- **Login v3** — gradient left panel with features + testimonial, clean right form
- **AttendanceWidget** — light card (white bg, indigo net strip, green/red buttons)
- **All missing CSS classes added** — nav-item, org-switcher, sidebar-header, dashboard-grid, bar-chart, activity-list, donut-*, kpi-list, av, mb-5

### ~~Priority 1 — UI/UX Fixes~~ ✅ DONE (session 7, 2026-03-16)
- See Session 7 below for all redesigns completed.

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
├── api/client.ts                  — fetch wrapper + refresh interceptor
├── hooks/useSession.ts            — session restore from localStorage (no /auth/me round-trip)
├── types.ts                       — shared TypeScript types (incl. Leave Policy + Balance types)
├── styles/
│   └── design-system.css         — UPDATED (session 7): btn-outline-success, btn-outline-reject
├── components/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Timesheets.tsx             — REWRITTEN (session 6): PulseHQ v3.0, week strip, entry cards
│   ├── Leave.tsx                  — REWRITTEN (session 7): PulseHQ v3.0, balance cards, calendar sidebar
│   ├── Approvals.tsx              — REWRITTEN (session 7): PulseHQ v3.0, KPI cards, tab filter
│   ├── Reports.tsx
│   ├── Notifications.tsx
│   └── Admin/
│       ├── Projects.tsx
│       ├── Categories.tsx
│       ├── Users.tsx              — UPDATED (session 7): Leave Policy dropdown + table column
│       ├── Holidays.tsx
│       └── LeavePolicies.tsx      — NEW (session 7): create/edit leave policies with allocations
└── App.tsx                        — UPDATED (session 6/7): React Router v7, /leave-policies route

apps/api.tests/
├── CustomWebApplicationFactory.cs — FIXED: EF Core 9 dual-provider conflict
└── TimeSheet.Api.Tests.csproj     — UPDATED: net10.0, EF Core 9.0.0

db/schema.sql                      — UPDATED: new tables, indexes, IsBillable column
PROJECT_TASKS.md                   — UPDATED: audit findings + Phase 2 task list
```

---

---

## Session 7 — Approvals, Timesheets & Leave Redesign + Leave Policy Feature (2026-03-16)

### What Was Done

#### Timesheets Page — PulseHQ v3.0 (branch: master, commit: `9116a0c`)
- Full rewrite of `Timesheets.tsx` to match PulseHQ reference screenshot.
- Two-column layout: `ts3-main` (flex: 1) + `ts3-sidebar` (280px sticky).
- **Week strip**: 7-day grid cards with hours logged, colored progress bars, click to navigate days.
- **Entry cards**: 3px colored left border by project index (`BORDER_COLORS`), time range parsed from `[HH:MM-HH:MM]` prefix in `notes` field.
- **Entry form**: dashed `#a5b4fc` border, light indigo bg, project/category/duration + start/end time rows.
- **Sidebar**: Active Timer (inline attendance check-in/out, live HH:MM:SS clock), Week Summary (from `GET /timesheets/week`), Today By Project.
- Start/end times stored as `[HH:MM-HH:MM]` prefix in existing `notes` field — **no backend schema change needed**.
- `Timesheets.test.tsx` updated to match new UI text. All 17 tests pass.

#### Approvals Page — PulseHQ v3.0 (branch: master, commit: `b56077a`)
- Full rewrite of `Approvals.tsx` replacing table layout with card-based layout.
- **KPI stats row**: 4 cards — Pending (derived from data), Approved this month, Rejected this month, Avg response time (last 3 show `—` until `GET /approvals/stats` backend endpoint is built).
- **Tab filter**: All / Timesheets / Leave — filters the unified card list.
- **Approval cards**: colored left border (indigo for timesheets, amber for leave), avatar with colored initials, inline reject form expanding below card.
- **Unified list**: fetches both `GET /approvals/pending-timesheets` and `GET /leave/requests/pending` and renders in one list.
- Added `btn-outline-success` and `btn-outline-reject` to `design-system.css` — consistent outlined approve/reject buttons used in both Approvals and Leave pages.
- `Approvals.test.tsx` updated. All 17 tests pass.

#### Leave Page — PulseHQ v3.0 (branch: feature/leave-policy-redesign, commit: `bfb8b71`)
- Full rewrite of `Leave.tsx` to two-column layout.
- **Balance cards**: fetches `GET /leave/balance/my`; one card per leave type with remaining/total days and colored progress bar. Gracefully shows nothing on API failure.
- **Apply form**: date-range (From/To date), Duration dropdown (Full day/Half day), Reason textarea. Submits with `{ leaveTypeId, fromDate, toDate, isHalfDay, comment }` — **new API shape required on backend**.
- **Leave History**: fetches `GET /leave/requests/my/grouped`; falls back to `GET /leave/requests/my` per-day records if endpoint not yet implemented. Year filter (2023–2028). Columns: TYPE · DATES · DAYS · APPLIED ON · APPROVED BY · STATUS.
- **Sidebar — Mini Calendar**: interactive month calendar with prev/next navigation. Fetches `GET /leave/calendar?year=Y&month=M` for pending/approved leave dots. Graceful fallback.
- **Sidebar — Team on Leave**: fetches `GET /leave/team-on-leave`; shows avatar, name, date range, status pill. Hidden if API fails.
- Manager and Admin sections preserved at bottom of main column.
- `Leave.test.tsx` written with 27 tests.

#### Admin/LeavePolicies.tsx — New Page (branch: feature/leave-policy-redesign, commit: `bfb8b71`)
- New admin page at `/leave-policies` (admin-only, wired into AppShell nav).
- Lists all leave policies from `GET /leave/policies`.
- Create/Edit form: policy name + active checkbox + allocations table (one row per active leave type, days-per-year number input).
- Policies table: NAME · ALLOCATIONS SUMMARY · STATUS · Edit/Delete actions.
- Wired into `App.tsx` routes and `AppShell.tsx` nav under `"leave-policies"` view key.

#### Admin/Users.tsx — Leave Policy Assignment (branch: feature/leave-policy-redesign, commit: `bfb8b71`)
- Added `leavePolicies` state fetched from `GET /leave/policies`.
- Added `leavePolicyId` to `UserForm` type, `BLANK`, `openEdit`, and save body.
- Added Leave Policy `<select>` field in create/edit form (after Work Policy).
- Added Leave Policy column to users table.

#### Types & Routing
- `types.ts`: Added `LeaveBalance`, `LeavePolicyAlloc`, `LeavePolicy`, `LeaveRequestGroup`, `TeamLeaveEntry`.
- `User` type extended with `leavePolicyId: string | null` and `leavePolicyName: string | null`.
- `View` union extended with `"leave-policies"`.
- `App.tsx`: Added `/leave-policies` route (admin-only) and nav entry.
- `AppShell.tsx`: Added `"leave-policies": "Leave Policies"` to `VIEW_LABELS` and nav icon.

### Build & Tests
- `npm run build` — ✅ passes, zero TypeScript errors, 329 KB JS bundle.
- `npm run test` — ✅ 44/44 tests pass across 5 test files.

### Branches & PRs
- **master**: Timesheets v3, Approvals v3 commits (`9116a0c`, `b56077a`)
- **feature/leave-policy-redesign**: Leave v3 + LeavePolicies + Users update (`bfb8b71`) — PR raised at https://github.com/Vishnu90Coreinn/TimeSheet/pull/new/feature/leave-policy-redesign

---

## Pending For Next Session

> Last updated: Session 10 (2026-03-16). Reports page fully refactored (7 tabs, 3 new endpoints, 16 UX improvements). All session 9 Leave + Timesheets work committed and pushed. Smoke test and next feature selection is the immediate priority.

### Priority 1 — Manual Smoke Test
Work through these flows and confirm they work end-to-end:
- [ ] Run API → confirm DB auto-migrates (Sprint9 migration runs, creates LeavePolicies/LeaveBalances tables)
- [ ] Admin creates Leave Policy → assigns to user → employee sees correct balances on Leave page
- [ ] Employee applies leave → cancel it → re-apply (confirm no 500 error)
- [ ] Admin: Reports → Leave Balance tab → verify allocations and used days
- [ ] Admin: Reports → Overtime/Deficit tab → verify weekly grouping and delta coloring
- [ ] Admin: Reports → Approvals tab → verify two-line Approved At, status chips, approver name
- [ ] Submit timesheet → delete entry modal appears (themed, not browser confirm)

### Priority 2 — Next Features (choose one to build)

| Feature | Effort | Value |
|---------|--------|-------|
| **True Excel/PDF export** — EPPlus/ClosedXML for real Excel; PDF renderer | Medium | High |
| **`GET /approvals/stats`** backend — approved/rejected this month, avg response hours for KPI cards | Small | High |
| **Dashboard activity feed** — real last-24h events from `GET /dashboard/activity` | Medium | High |
| **Mobile responsive layout** — sidebar collapses to hamburger on small screens | Medium | Medium |

---

## Session 8 — UI Compactness + Dashboard Redesign (2026-03-16)

### What Was Done

#### AppShell Cleanup
- Removed the redundant `sidebar-user-section` block (username/avatar/role shown a second time in the sidebar below the org switcher — it was already in the topbar right corner).
- Changed `org-switcher` label from `session.username` → `"TimeSheet HQ"` so the username no longer appears in two places in the sidebar.

#### Global UI Compactness (`design-system.css`)
- Topbar height: `60px` → `52px`
- Sidebar width: `252px` → `248px`
- Page content padding: `var(--space-8)` (32px) → `var(--space-6)` (24px)
- Page header margin-bottom: `var(--space-6)` (24px) → `var(--space-4)` (16px)
- Added `.wbc-*` classes for the new Weekly Bar Chart component

#### Dashboard Redesign — Employee View (matching screenshots 6.png / 7.png)
`Dashboard.tsx` complete redesign of `EmployeeDashboard`. Now fetches **4 endpoints in parallel**:
- `GET /dashboard/employee` — attendance, timesheet status, project effort, compliance trend
- `GET /timesheets/week` — per-day breakdown Mon–Sun with enteredMinutes / expectedMinutes
- `GET /leave/balance/my` — all leave types with remaining days
- `GET /projects` — for active project count KPI

**New layout:**
- **Row 1 — Page Header:** Greeting `Good morning, {username} 👋` + today's date subtitle + Export + `+ Log Time` buttons
- **Row 2 — 4 KPI Cards:**
  1. Hours This Week (`{h}h`, % of target hit badge)
  2. Approval Rate (`{pct}%`, computed from monthly compliance trend)
  3. Active Projects (count of active projects assigned to user)
  4. Leave Balance (`{n}d`, annual leave type + FY)
- **Row 3 — 2 columns:**
  - Weekly Hours Breakdown bar chart (Mon–Sun, indigo filled bars vs n-100 ghost target bars, `↑X% target hit` badge)
  - Project Split donut (`{totalH}h` centre label + per-project KPI bars)
- **Row 4 — 3 columns:**
  - Recent Activity (synthesised from check-in, timesheet status, project entries)
  - Attendance Widget (existing)
  - Leave Balance card (all leave types with used/total progress bars)

#### Dashboard Redesign — Manager View
- Added **inline Pending Approvals panel** in the bottom row (fetches `GET /approvals/pending-timesheets` locally inside `ManagerDashboard`).
- Quick ✓ approve button per row (calls `POST /approvals/{id}/approve` inline from dashboard).
- Renamed bottom-right panel from generic to **Budget Health** (project effort bars).
- DonutChart updated to accept optional `centerLabel` / `centerSub` props (shows `44h / Total` instead of `%`).

#### Backend — BudgetedHours on Project
- `apps/api/Models/Project.cs` — added `BudgetedHours: int = 0`
- `apps/api/Dtos/ProjectDtos.cs` — added to `UpsertProjectRequest` (default 0) and `ProjectResponse`
- `apps/api/Controllers/ProjectsController.cs` — all 4 projections updated
- `apps/api/Controllers/TimesheetsController.cs` — fixed missing `BudgetedHours` in `ProjectResponse` constructor call
- `db/schema.sql` — `BudgetedHours INT NOT NULL DEFAULT 0` column added to `Projects`
- `apps/web/src/types.ts` — `Project.budgetedHours: number` added

### Build & Tests
- `npm run build` — ✅ passes, zero TypeScript errors, 331 KB JS bundle
- `npm run test` — ✅ 44/44 tests pass (5 test files)
- `dotnet build` — ✅ passes, 0 errors

### Commit & Push
- Committed and pushed to `master`

---

---

## Session 9 — Leave Backend + UX Polish (2026-03-16)

### What Was Done

#### Leave Backend (Sprint 9 APIs)
- `GET /leave/policies`, `POST`, `PUT /{id}`, `DELETE /{id}` — full Leave Policy CRUD.
- `GET /leave/balance/my` — reads `LeavePolicyAllocations.DaysPerYear` (not the `LeaveBalances` table which is for manual overrides only).
- `POST /leave/requests` — now accepts `fromDate`/`toDate` date range; expands to per-day `LeaveRequest` rows server-side.
- `GET /leave/calendar?year=&month=` — returns pending/approved/**rejected** leave dates.
- `GET /leave/team-on-leave` — team members on leave.
- `GET /leave/requests/my/grouped` — grouped history (one record per request, not per day).
- `DELETE /leave/requests/{id}` — cancel endpoint; matches by `LeaveGroupId` first then `Id`; enforces pending-only guard.
- **Bug fix:** `POST /leave/requests` re-apply 500 error — `UQ_LeaveRequests_UserDate` unique constraint blocks re-inserting after rejection. Fix: delete rejected rows for those dates before inserting new ones.

#### DB Migrations — Two-Migration Split
- `Baseline` migration: marks `Initial` as already applied without re-running it.
- `Sprint9` migration: adds `LeavePolicies`, `LeavePolicyAllocations`, `LeaveBalances` tables.
- `DbInitializer.MigrateAsync()` bootstraps `__EFMigrationsHistory`, marks `Initial` applied, then `MigrateAsync()` runs `Sprint9` delta automatically on API start.

#### Leave.tsx — 18 UX Improvements
Full rewrite covering: responsive history cards (not table), human-readable date ranges (`fmtDateRange`), Re-apply/Cancel actions per row, `ToDate < FromDate` validation shown inline, admin "Apply on behalf of" user dropdown, zero-allocation balance card greyed, rejected calendar dots, Leave Report icon, form label 13px, Reset btn-outline style, semantic bar colors, min-height textarea, normalized legend circles, standardized header casing, Remove "Create Leave Type" from this page (moved to LeavePolicies admin).

#### LeavePolicies.tsx — Leave Types Section
New card below policies table: inline form (name + active checkbox + submit) + table of all leave types with Active/Inactive badges. Calls `POST /leave/types` and refreshes list.

#### Timesheets.tsx — 8 UX Fixes
- Entry card left border turns **green** for approved timesheets.
- Progress bar "13%" label: fixed from absolute positioning to flex layout (no overlap).
- Hours text **green** color on approved day cards.
- **+ Add Entry** button visually disabled (opacity 0.45, `pointer-events: none`) on locked timesheets; tooltip grammar fixed "a approved" → "an approved".
- Day bar pill turns **green** when the selected day is approved.
- Sunday pct = 0 bug fixed: if `expectedMinutes === 0` and `mins > 0`, set pct = 100 and use light-indigo color `#a5b4fc` ("rest day with work").
- Notification bell **unread indicator dot** added.
- Removed negative margin on `.ts3-week-prog-wrap`.

#### Delete Entry Modal
Replaced `window.confirm()` with a themed modal: backdrop blur, indigo icon ring, Keep/Delete buttons styled to match PulseHQ v3.0 design system.

#### Leave.test.tsx — Tests Updated
- 3 tests rewritten for history cards (no longer a table), calendar legend text (`.^Pending$`/`.^Approved$`), admin section dropdown check.

### Build & Tests
- `npm run test` — ✅ 44/44 tests pass
- `dotnet build` — ✅ 0 errors

---

## Session 10 — Reports Page Full Refactor (2026-03-16)

### What Was Done

#### Backend — 3 New Report Endpoints
- `GET /reports/leave-balance` — reads `LeavePolicyAllocations` × approved `LeaveRequests` per user+type for the requested year. Returns `LeaveBalanceReportRow(UserId, Username, LeaveTypeName, AllocatedDays, UsedDays, RemainingDays)`.
- `GET /reports/timesheet-approval-status` — timesheets with `Status`, `EnteredMinutes`, `ApprovedByUsername`, `ApprovedAtUtc`. Returns `TimesheetApprovalStatusReportRow`.
- `GET /reports/overtime-deficit` — weekly grouping (Mon–Sun) of logged vs target minutes. Target = non-Sunday workdays × `WorkPolicy.DailyExpectedMinutes` (defaults to 480 if no policy). Returns `OvertimeDeficitReportRow(UserId, Username, WeekStart, TargetMinutes, LoggedMinutes, DeltaMinutes)`.
- `BuildRawReport` updated with 3 new cases for CSV export of all new report types.
- `ReportDtos.cs`: 3 new records added.

#### Frontend — Reports.tsx Full Redesign (16 improvements)
1. **Default date range**: From = first day of current month, To = today — pre-filled on mount.
2. **Tab strip scroll arrows**: `‹` `›` buttons with `scrollBy` on the tabs container; hidden scrollbar.
3. **Attendance aggregation**: `aggregateAttendance()` deduplicates rows by employee+date, summing minutes and OR-ing exception flag.
4. **Utilization bar thresholds**: `< 50%` red, `50–79%` amber, `≥ 80%` green (was 40/70).
5. **Sort icons**: `↕` on all sortable headers (inactive), `↑`/`↓` when active; `aria-sort` attribute.
6. **Leave Balance bar**: `minWidth: 90px` track; rows with `allocatedDays === 0` get `opacity: 0.4`.
7. **`d` unit suffix**: New `"leave-days"` format renders `Nd` for all day-count columns.
8. **KPI accent borders**: `border-left: 3px solid` in red/amber/green per card significance. Exceptions → red, Deficit Weeks → amber, Overtime Weeks → green, Zero Balance → red, Approved → green, Net Delta → colored.
9. **Approved At two-line**: Date bold on line 1, muted time on line 2; full datetime in `title` tooltip.
10. **PDF export**: `↓ PDF` button added alongside CSV/Excel.
11. **Employee filter**: Dynamic `<select>` from unique usernames on current page. Resets on tab switch.
12. **Context-specific KPI labels**: "Days Tracked", "Weeks Tracked", "Allocations" — no generic "Records".
13. **Primary text color**: `rgb(16,16,26)` + `font-weight: 500` on Employee, hours, and delta columns via `primary: true` ColConfig flag.
14. **Target column hidden**: `targetMinutes` hidden from UI; avg target shown as subtitle `"vs. Xh avg target/wk"` on Weeks Tracked KPI.
15. **Row hover**: `rgba(99,102,241,0.04)` on `tbody tr:hover`.
16. **Rich pagination footer**: "Showing 1–25 of 120" text + rows-per-page selector (10/25/50/100) + Prev/Next buttons.

#### types.ts
- `ReportKey` union extended: `| "leave-balance" | "timesheet-approval-status" | "overtime-deficit"`.

### Build & Tests
- `npm run test` — ✅ 44/44 tests pass
- `dotnet build` — ✅ 0 errors (file-lock warning only — API was running)

### Commit & Push
- All changes committed and pushed to `master` (this session).

---

## Session 11 — Dashboard v2 (2026-03-16)

### What Was Done

#### Dashboard.tsx — 20 UI/UX Enhancements

**Critical Bug Fixes:**
- **Dept bar chart height=0** — Replaced CSS `.bar-tracks` with new `BarChartDept` component using inline flexbox + computed pixel heights. Bars now render correctly.
- **Compliance dates** — All raw ISO strings now formatted via `fmtDateHuman()` (e.g. "Mar 14" / "2 days ago"). Username + rule shown as sub-label.
- **Dept label truncation** — `r.department.slice(0, 4)` replaced with full name + `text-overflow: ellipsis` via `title` attribute.

**High Priority:**
- Replaced all emoji stat card icons with 10 dedicated stroke SVG components (IconClock, IconBuilding, IconBarChart, IconPeople, IconLeaf, IconCheckCircle, IconAlert, IconLayers, IconRefresh, IconChevronDown).
- Stat card trend badges now reflect real data (↑/↓/flat based on values).
- `UtilBar` component: 60px/4px mini progress bar, red <50%, amber 50–79%, green ≥80%; shown in both Manager and Admin Utilization cards. Header "Target: 40h/week".
- Zero-value legend items dimmed to `opacity: 0.4`.
- `DonutChart` enlarged (130px admin, 110px manager/employee); each arc now has `<title>` tooltip; `centerSub` shows dominant segment label.
- 4th admin stat card changed from "Non-billable (30d)" → **Pending Approvals** (amber when >0, green when 0, "Review →" link).
- Effort by Project: `% of total` label added per row + "→ View" link navigating to Reports.
- Semantic heading hierarchy: `page-title` → `<h1>`, `card-title` → `<h2>`.

**Medium Priority:**
- Period selector added next to Export button: Today / This Week / Last 30 Days / This Quarter.
- Data freshness label: "Last updated: [datetime] · ↻ Refresh" below page header.
- Activity items are now interactive: `cursor: pointer` + `onClick` → navigate to relevant view.
- Export button → split button with PDF / CSV / Copy link dropdown (closes on outside click).
- Bottom admin row changed from 3-column to 4-column grid.

**New Widgets:**
- **"Who's on Leave Today"** — 4th column in bottom grid; fetches `/leave/team-on-leave`; empty state "No one on leave today ✓".
- **Sparkline** on Billable Ratio stat card — 6-point SVG polyline (52×16px), color matches on-track/below-target.
- **Timesheet Submission Rate** — full-width row below bottom grid; progress bar + "Send reminder →" CTA.

**AdminDashboard additional fetches:** `/leave/team-on-leave`, `/approvals/pending-timesheets`, `/users`.

**Tests:** All 44 frontend tests continue to pass. TypeScript: 0 errors.

**Commits:** `982475b`

---

## Pending For Next Session

> Last updated: Session 11 (2026-03-16). Dashboard v2 complete with all 20 enhancements. All 44 frontend tests pass.

### Priority 1 — Manual Smoke Test
- [ ] Run API → confirm DB auto-migrates (`Sprint9` migration runs)
- [ ] Admin: create Leave Policy → assign to user → employee sees correct balance on Leave page
- [ ] Admin: navigate to Reports → **Leave Balance** tab → verify allocations + used days shown
- [ ] Admin: Reports → **Overtime / Deficit** tab → verify weekly grouping and delta coloring
- [ ] Admin: Reports → **Approvals** tab → verify status chips, two-line Approved At, approver name
- [ ] Employee: apply leave → cancel it → re-apply → confirm no 500 error
- [ ] Timesheets: submit day → verify delete entry modal (themed, not browser confirm)
- [ ] Reports: change date range → Apply → verify data refreshes; change rows/page → verify pagination

### Priority 2 — Next Features (choose one)

| Feature | Effort | Value |
|---------|--------|-------|
| **True Excel/PDF export** — integrate EPPlus/ClosedXML for real Excel; use a PDF renderer for PDF | Medium | High |
| **`GET /approvals/stats`** — backend endpoint for Approvals KPI cards (approved/rejected this month, avg response hours) | Small | High |
| **Dashboard activity feed** — real last-24h events from `GET /dashboard/activity` | Medium | High |
| **Mobile responsive layout** — sidebar collapses to hamburger on small screens | Medium | Medium |
| **Reports: category breakdown sub-rows** — expandable contributor list per project in Project Effort tab | Medium | Medium |

---

## Known Issues / Gotchas

- **EF Core 9 dual-provider in tests:** The fix in `CustomWebApplicationFactory.cs` removes `IDbContextOptionsConfiguration<TimeSheetDbContext>` service descriptors by name match (`d.ServiceType.Name.StartsWith("IDbContextOptionsConfiguration")`). Do not revert this — it will break all 35 tests.
- **net10.0 only:** The dev machine only has .NET 10 runtime installed, not .NET 8. Both `.csproj` files target `net10.0`. Do not downgrade.
- **`gh` CLI not installed:** GitHub CLI (`gh`) is not available on this machine. All GitHub operations (PR creation, etc.) must be done via browser or by installing `gh`.
- **RefreshTokenCleanupService uses `ExecuteDeleteAsync`:** This is an EF Core 7+ bulk delete. Requires SQL Server provider in production (InMemory does not support it — the service uses try/catch to swallow the InMemory error).
- **`AuditService.WriteAsync` does NOT call `SaveChangesAsync`:** The caller is responsible. This is intentional so audit log entries are part of the same transaction as the main entity change.
