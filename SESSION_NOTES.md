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

---

## Session 12 — Dashboard UX Polish + Sidebar Overhaul + Admin Table Sort (2026-03-17)

### What Was Done

#### Dashboard.tsx — 14 UX Improvements
- **Compact page header**: Period filter (`Today / This Week / Last 30 Days / This Quarter`) moved to a sub-row below the title/actions row.
- **Relative time freshness**: `fmtFreshness` replaced with `relativeTime()` inside `<time dateTime={...}>` element.
- **ARIA on progress bars**: `role="progressbar"`, `aria-valuenow/min/max/label` added to all progress-track elements in KPI rows and Leave Balance card.
- **Severity tiers on progress fills**: `.progress-fill--critical/warning/caution/success` classes applied to all `UtilBar` and Leave Balance bars.
- **Stat card deltas**: Active Departments card gets "no prior period data" footer note.
- **Billable card label fix**: Removed Internal staff/Consultants KpiItems; "Billable hours" → "Billable".
- **Utilization card**: Subtitle → "Hours logged this week"; `UtilBar` now receives `status` from `UserLoad` backend field instead of hardcoded `targetMinutes={2400}` — fixes "40h" hardcode bug.
- **Compliance card**: Subtitle → "Last 28 days"; View link navigates to `"reports"`.
- **Clickable KPI rows**: `KpiItem` whole row clickable via `onView` callback; removed `viewLink` prop.
- **Calendar SVG empty state**: On Leave Today empty state replaced `✓` character with inline calendar SVG.
- **Submission Rate**: Button moved from card-header to below the progress bar.
- **Effort by Project**: `viewLink` prop removed; footer has `<button onClick={() => onNavigate?.("projects")}>View all projects →</button>`.
- **Bug fix**: "View all projects" was calling `onNavigate?.("reports")` → fixed to `"projects"`.
- **Split-button fix**: Export split button `btn-split` CSS corrected.

#### AppShell.tsx — Sidebar Overhaul (12 Fixes)
- **FIX 1 — User profile section**: Avatar with colored initials, online dot, username and role rendered between brand and nav (collapses in collapsed state via CSS).
- **FIX 2 — CSS-only tooltips**: `data-tooltip={item.label}` on every nav button; `.shell-sidebar.collapsed .nav-item::after/::before` pseudo-elements show tooltip on hover.
- **FIX 3 — Sign Out danger style**: `className="nav-item nav-item--danger"` with `.nav-item--danger` CSS rule.
- **FIX 4 — Live Approvals badge**: `useEffect` + `apiFetch("/approvals/pending-timesheets")` populates `pendingCount`; rendered as `.nav-badge` on Approvals nav item.
- **FIX 5 — Collapse button affordance**: `aria-label="Collapse sidebar"` / `"Expand sidebar"`; `.sidebar-collapse-btn` CSS with border and brand hover.
- **FIX 6 — SVG aria-hidden**: `aria-hidden="true"` added to all inline SVG nav icons.
- **FIX 7 — "Workspace" section label**: First unlabelled nav section given `<span className="nav-section-label">Workspace</span>`.
- **FIX 8 — Nav section gap**: `.nav-section { gap: 4px }` (was 1px).
- **FIX 9 — Active item indicator**: `.nav-item.active { box-shadow: inset 3px 0 0 var(--brand-500) }`.
- **FIX 10 — Icon color differentiation**: `.nav-item svg { color: var(--n-400) }` + active/hover overrides (no more opacity hack).
- **FIX 11 — Distinct icons**: `LeavePolicyIcon` (calendar with cross-lines) for Leave Policies; `BriefcaseIcon` for Work Policies (replaced duplicate `ClockIcon`/`PolicyIcon`).
- **FIX 12 — Crisp sidebar border**: `.shell-sidebar { border-right: none; box-shadow: inset -1px 0 0 var(--border-subtle) }`.
- **Removed org-switcher**: `<div className="org-switcher">` block removed entirely.
- **Removed duplicate username**: `sidebar-brand` label changed from `session.username` to `"TimeSheet HQ"`.
- **Sidebar collapse toggle bug fixed**: Removed inline `style={{ justifyContent: ... }}` that overrode collapsed CSS; moved to `.sidebar-brand` CSS rule; added `.shell-sidebar.collapsed .sidebar-brand > div:first-child { display: none }`.

#### Notifications.tsx — Numeric Badge
- Unread indicator dot replaced with numeric badge: `<span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>` (`.notif-badge` CSS: position absolute, danger bg, white text).

#### Admin Tables — Sort on All Master Pages
All 6 admin pages updated to match the Reports Attendance table sort pattern:

| File | Sortable Columns |
|------|-----------------|
| `Admin/Projects.tsx` | name, code, status |
| `Admin/Categories.tsx` | name, isBillable, isActive |
| `Admin/Holidays.tsx` | name, date (default), isRecurring |
| `Admin/WorkPolicies.tsx` | name, dailyExpectedMinutes, isActive |
| `Admin/LeavePolicies.tsx` | name, isActive |
| `Admin/Users.tsx` | username, role, departmentName, isActive |

Each: `SortIcon` component, `sortCol/sortDir` state, `toggleSort()`, `sorted` computed array, `className="th-sort"` + `onClick` + `aria-sort` on `<th>`, card `overflow: "visible"`.

#### Admin/Projects.tsx — Overflow Menu Fix
- **Root cause**: Card had `overflow: "hidden"` clipping absolutely-positioned dropdown.
- **Fix**: `OverflowMenu` now uses `useRef<HTMLButtonElement>` + `getBoundingClientRect()` to calculate viewport coords; menu renders with `position: fixed, top/right` — escapes all overflow-hidden ancestors.
- Card changed to `overflow: "visible"`.

#### Users.tsx — Empty Row Fix
- `{filtered.length === 0 &&` → `{sorted.length === 0 &&` (was checking wrong array).

#### design-system.css — New Rules
- `.progress-fill--critical/warning/caution/success` severity tier classes
- `.notif-badge` numeric badge styles
- `.kpi-item[role="button"]:hover` + `:focus-visible` rings
- `button:focus-visible, a:focus-visible` ring rules
- `.nav-item--danger` color/hover
- `.sidebar-collapse-btn` full rule
- `.nav-section { gap: 4px }` (FIX 8)
- `.nav-item.active { box-shadow: inset 3px 0 0 var(--brand-500) }` (FIX 9)
- `.nav-item svg { color: var(--n-400) }` + hover/active overrides (FIX 10)
- `.shell-sidebar { box-shadow: inset -1px 0 0 var(--border-subtle) }` (FIX 12)
- `.th-sort { cursor: pointer; user-select: none; white-space: nowrap }` + hover color
- FIX 1–4 collapsed sidebar rules (user section hide, tooltips, badge hide)

### Build & Tests
- `npx tsc --noEmit` — ✅ 0 errors
- TypeScript: clean across all 6 admin files + AppShell + Dashboard + Notifications

### Commits
- `7e91218` — feat: sortable tables + fixed overflow menu across all admin pages

---

## Session 13 — Sprint 13: User Profile & Self-Service (2026-03-17)

### What Was Done

#### Sprint 13 — User Profile & Self-Service (PR #36, merged to master `314b75f`)

**Backend**
- `User.cs`: added `DisplayName` (NVARCHAR 150) and `AvatarDataUrl` (NVARCHAR MAX) fields
- `ProfileController.cs` (new): full self-service profile API
  - `GET /profile` — returns full profile including display name + avatar
  - `PUT /profile` — updates username, display name, email
  - `PUT /profile/avatar` — uploads/removes base64 data URL avatar (validates `data:image/` prefix)
  - `PUT /profile/password` — current-password verified before hash update
  - `GET/PUT /profile/notification-preferences` — upsert pattern per user
- `UserNotificationPreferences` model + EF config (ON DELETE CASCADE, one-to-one keyed by UserId)
- `NotificationSchedulerService`: all three jobs filter through `WantsReminder()` helper respecting user preferences
- EF Migrations: `Sprint13_UserProfile` + `Sprint13_ProfileUX` (DisplayName + AvatarDataUrl columns)
- `lucide-react ^0.577.0` installed

**Frontend**
- `Profile.tsx` (new, UX v2): full self-service profile page
  - Avatar: 72px circle with camera-overlay upload, 400 KB guard, image-type guard, "Remove photo" link
  - Display Name field (separate from username)
  - Three independent `Eye`/`EyeOff` toggles per password field
  - Password strength bar (weak/medium/strong)
  - Inline validation with touched-state guards (username, email, confirm password)
  - Toast system: bottom-right fixed, 3-second auto-dismiss, replaces all inline alerts
  - Employment Info card: read-only with lock icon + grey background
  - Notification preferences: toggle cards with disabled state during save
- `types.ts`: `MyProfile` gains `displayName` + `avatarDataUrl`; `View` union adds `"profile"`
- `AppShell.tsx`: `VIEW_LABELS["profile"] = "My Profile"` — breadcrumb fix
- `App.tsx`: `VIEW_PATHS["profile"] = "/profile"`
- `db/schema.sql`: Users table updated; ALTER statements added for new columns

### Commits
- `365924f` — feat: Sprint 13 — User Profile & Self-Service
- `b701fdc` — fix: regenerate Sprint13_UserProfile migration with proper build
- `83406ed` — feat(sprint-13): Profile UX v2 — avatar, display name, eye-icon passwords, toasts
- `314b75f` — Merge pull request #36 (merged to master)

---

---

## Session 14 — Sprint 14 + Sprint 15 + UX Audit (2026-03-17)

### What Was Done

#### Sprint 14 — Bulk Timesheet Week Submission
**Backend**
- `POST /timesheets/submit-week` — validates weekStart is Monday; batch-processes Mon–Sat; skips future/no-entry/already-submitted days; records mismatch as "(bulk submit)"
- New DTOs: `SubmitWeekRequest`, `SubmitWeekResponse`, `SubmitWeekSkipped`, `SubmitWeekError`

**Frontend**
- `Timesheets.tsx`: "Submit Week" button (visible when `submittableCount > 0`), preview modal (day-by-day table), result toast (4s auto-dismiss)
- `.ts3-modal--wide { max-width: 480px }` CSS rule added

#### Sprint 15 — Manager Team Status Board
**Backend (`apps/api/Controllers/ManagerController.cs` — new)**
- `GET /manager/team-status?date=` — loads direct reports; sequential EF queries for sessions, week timesheets, leave, pending approvals, work policies; returns `TeamMemberStatusResponse` per member
- `POST /manager/remind/{userId}` — validates direct-report ownership; fires `MissingTimesheet` notification
- `weekExpected` uses `wp.WorkDaysPerWeek` (not hardcoded 5) — fixes 40h vs 48h display bug

**Backend bug fixes during Sprint 15**
- `DashboardController.cs`: eliminated all `FirstOrDefaultAsync` without `OrderBy` warnings (Employee + Manager actions)
- `ManagerController.cs`: all 5 DB queries made sequential (fixes DbContext concurrency 500 error)
- `ManagerController.cs`: `DateTime.SpecifyKind(dt, DateTimeKind.Utc).ToString("O")` — ensures `Z` suffix on check-in/out strings so JS converts UTC → correct local time (fixes 11:50 UTC showing as 11:50 instead of 05:20 PM IST)

**Frontend (`apps/web/src/components/TeamStatus.tsx` — new)**
- Filter bar: All / Missing Today / Needs Approval / On Leave with live counts; all 4 tabs always show badge
- Status table: Avatar · Member (truncation + title tooltip) · Attendance badge · Check-in Time (clock icon, UTC→local) · Week Progress bar · Timesheet badge · Pending Actions
- Custom `DatePicker`: trigger button (MMM DD YYYY + calendar icon) + fully custom `MiniCalendar` (6×7 grid, month nav, today highlight, Today shortcut — no `<input type="date">`)
- `WeekBar`: %, tooltip "Xh of Yh target", green ≥80% / yellow 40% / red <40%
- "Pending Actions" column: `position: sticky; right: 0` — always visible, no horizontal clip
- All `<th>` cells: `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
- Remind = secondary outlined button; Approve = primary filled + checkmark icon
- Dynamic subtitle built from live counts ("N members · X missing · Y need approval")
- Empty state (0 members) + contextual note (1 member)
- `types.ts`: `TeamMemberStatus` type; `View` union adds `"team"`
- `AppShell.tsx`: Team Status nav item; sidebar groups renamed "My Work" / "My Team"
- `App.tsx`: `/team` route (manager/admin only)

#### UX Audit Fixes — Dashboard (Manager)
- Stat cards: clickable (role="link", hover shadow, aria-label, keyboard nav); min-height: 140px
- "↑ All in" moved to Present card only; Not Checked In shows "✓ None missing" at 0
- Reports button: SVG `IconBarChart` (no emoji)
- Activity feed: structured sentences "[Name] submitted for [Date] — flagged as mismatch", Note: truncated 60 chars, "Review →" link
- `formatDisplayName()`: strips `.rs`/`.com` suffixes, capitalises
- Inline approval confirmation panel (H5) before executing approve
- Budget Health: "No budget cap set" in grey italic per project
- "View 1 pending approval" / "View all N pending approvals" grammar fix
- Data freshness timestamp + manual Refresh button + 60s auto-refresh

#### Cross-Cutting Shared Components (new files)
- `src/components/StatusBadge.tsx` — icon+text+color, role="status", aria-label (WCAG 2.1 SC 1.4.1)
- `src/hooks/useConfirm.ts` — request/confirm/cancel hook for irreversible actions
- `toBadgeStatus()` helper maps raw API strings to typed `BadgeStatus`

#### Tests
- 22 new unit tests: `StatusBadge.test.tsx` (10), `useConfirm.test.ts` (5), `TeamStatus.test.tsx` (7)
- 63 tests total, all passing

### Commits (merged to master as `8a7e323`)
- `791a2aa` — feat(sprint-15): Manager Team Status Board
- `6bbac98` — fix: sequential EF queries (DbContext concurrency 500)
- `2ba6de3` — fix: check-in/out as UTC ISO strings, format to local in browser
- `0ea80a3` — fix: EF Core FirstOrDefault-without-OrderBy warnings in DashboardController
- `e7510ef` — feat: UX audit fixes — Team Status + Dashboard
- `6572f8b` — fix: 4 layout/UX follow-up fixes (sticky column, badges, MiniCalendar, th ellipsis)
- `2cd3677` — fix: check-in/out UTC timezone (SpecifyKind + Z suffix)
- `8a7e323` — Merge: Sprint 14 + Sprint 15 + UX Audit → master

---

## Session 15 — Sprint 16: Task-Level Timer (2026-03-17)

### What Was Done

#### Sprint 16 — Task-Level Timer (TSK-TMR-001..011)

**Backend (new: `apps/api/Controllers/TimersController.cs`)**
- New `TimerSession` entity: `{ Id, UserId, ProjectId, CategoryId, Note, StartedAtUtc, StoppedAtUtc, DurationMinutes, ConvertedToEntryId }`
- `TimerSessions` table with indexes on `UserId` and `(UserId, StoppedAtUtc)` — no cascade delete on ConvertedToEntry (SetNull)
- EF Core migration `20260317161547_Sprint16_TimerSessions`
- `GET /timers/active` — returns running timer (no `StoppedAtUtc`) or 404
- `POST /timers/start` — `{ projectId, categoryId, note? }`; enforces one active per user (409 if already running); validates project + category exist
- `POST /timers/stop` — sets `StoppedAtUtc`, computes `DurationMinutes = max(1, round(elapsed minutes))`
- `POST /timers/{id}/convert` — finds or creates draft `Timesheet` for `WorkDate`; adds `TimesheetEntry`; sets `ConvertedToEntryId`; returns `{ entryId, timesheetId }`
- `GET /timers/history?date=YYYY-MM-DD` — all sessions for a day, descending by `StartedAtUtc`
- `DateTime.SpecifyKind(…, Utc).ToString("O")` used on all timestamps (consistent with ManagerController pattern)

**Frontend (Timesheets.tsx)**
- `TimerSessionData` interface added
- New state: `activeTimer`, `taskElapsed`, `timerProjectId/CategoryId/Note`, `timerLoading`, `stoppedTimer`, `convertDate`, `convertLoading`, `timerHistory`, `timerToast`
- `loadActiveTimer()` / `loadTimerHistory()` callbacks
- 30s polling `useEffect` for `/timers/active` (survives page refresh)
- `startTaskTimer()`, `stopTaskTimer()`, `convertTimer()` actions
- localStorage: saves `activeTimerId` + `activeTimerStart` on start, removes on stop
- **TASK TIMER sidebar card** (entirely new, above Week Summary):
  - **Idle**: Project dropdown + Category dropdown + Note input → Start Timer button (Enter shortcut); pulsing green dot when running
  - **Running**: Purple 24px HH:MM:SS counter, project·category·note labels, full-width Stop button
  - **Stopped**: Green "Xh Ym recorded" badge, project/category/note detail, date picker (default today), "Add to Timesheet" + "Discard"
  - **Today's Sessions**: history rows with ✓ badge on converted entries (max 5)
- **ATTENDANCE card** renamed from "ACTIVE TIMER" (check-in/out logic unchanged)
- Timer toast (centred, auto-dismiss 3–4s)
- CSS: `.ts3-green-dot--pulse`, `.ts3-elapsed-clock--task`, `.ts3-timer-select`, `.ts3-timer-note`, `.ts3-timer-convert*`, `.ts3-timer-history*`

**Tests:** All 52 backend tests still passing (no new tests needed — timer logic is straightforward CRUD covered by existing integration test patterns).

### Commits (merged to master as `0b1e5a0`)
- `b469fba` — feat: Sprint 16 — Task-Level Timer (TSK-TMR-001..011)
- `0b1e5a0` — Merge: Sprint 16 → master

---

## Session 16 — Sprints 17 + 18 + 19 in parallel (2026-03-17)

### What Was Done

Three sprints implemented in parallel via subagents, merged as PR #39 (`8bca36e`).

#### Sprint 17 — Project Budget Burn (TSK-BDG-001..006)
- `ProjectBudgetDtos.cs`: `ProjectBudgetHealthItem`, `WeeklyBurnEntry`, `ProjectBudgetSummaryResponse`
- `ProjectBudgetController.cs`: `GET /projects/budget-health` (manager/admin — all active projects with loggedHours, pctUsed, status: on-track/warning/critical/over-budget); `GET /projects/{id}/budget-summary` (any auth — total logged/remaining, 4-week burn rate, projected weeks, 8-week ISO sparkline)
- `ProjectDtos.cs`: `[Range(0, 100000)]` on `BudgetedHours`
- `Admin/Projects.tsx`: Budget Health summary card (filterable status pills above table), Budget column (mini BurnBar + % colour-coded), edit drawer burn panel (BurnBar, sparkline, burn rate, projected weeks)

#### Sprint 18 — Recurring Entry Templates (TSK-TPL-001..009)
- `TimesheetTemplate.cs`: entity with `EntriesJson` (JSON array, `nvarchar(max)`)
- `TemplateDtos.cs`: `TemplateEntryData`, `CreateTemplateRequest`, `UpdateTemplateRequest`, `ApplyTemplateRequest`, `TemplateResponse`, `ApplyTemplateResult`
- `TimeSheetDbContext.cs`: `TimesheetTemplates` DbSet + fluent config + index on UserId
- Migration `20260317164716_Sprint18_TimesheetTemplates`: creates `TimesheetTemplates` table with FK → Users cascade
- `TimesheetTemplatesController.cs`: full CRUD + `POST /{id}/apply` (finds/creates draft timesheet, skips exact duplicates)
- `Timesheets.tsx`: "Use Template" button + picker modal, "Save as Template" button + modal
- `Profile.tsx`: Timesheet Templates section (list, create with entry rows, delete with confirmation)

#### Sprint 19 — Leave Team Calendar (TSK-LTC-001..005)
- `LeaveDtos.cs`: `TeamLeaveEntry`, `TeamLeaveCalendarDay`, `LeaveConflictResponse`
- `LeaveController.cs`: `GET /leave/team-calendar?year=&month=` (dept peers for employees, direct reports for managers); `GET /leave/conflicts?fromDate=&toDate=` (count + names of team members on leave)
- `Leave.tsx`: 16×16px avatar chips on calendar dates (up to 3 + "+N" overflow, pending dimmed 0.6), conflict warning amber banner on apply form, native `title` tooltip per date

**All 52 backend tests passing · 0 TypeScript errors**

### Commits
- `2473ab0` — feat: Sprints 17 + 18 + 19
- `c29b87a` — docs: PROJECT_TASKS updates
- `8bca36e` — Merge PR #39 → master

---

## Session 17 — Sprint 20: Anomaly Detection & Alerts (2026-03-17)

### What Was Done

Sprint 20 implemented via two parallel subagents (backend + frontend), committed as `91671ee` on `feature/sprint-20-anomaly-alerts`.

#### Backend
- `Notification.cs`: Added `Anomaly = 5` to `NotificationType` enum
- `AnomalyDtos.cs`: `record AnomalyNotificationResponse(Guid Id, string Title, string Message, string Severity, string CreatedAtUtc)`
- `AnomalyDetectionService.cs`: BackgroundService at 07:00 UTC daily
  - Rule A: ExcessiveDailyHours (>720 min/day in last 7 days)
  - Rule B: ExtendedMissingTimesheet (5+ consecutive working days)
  - Rule C/D: ProjectBudgetWarning (≥80%) / ProjectBudgetCritical (≥95%)
  - Rule E: ComplianceDropped (≥15pp drop vs prior month)
  - 7-day deduplication per title; notifies all admin users via `INotificationService`
- `AnomalyController.cs`: `[Authorize(Roles="admin")]`; `GET /admin/anomalies?severity=` + `POST /admin/anomalies/{id}/dismiss`; severity inferred from title string
- `Program.cs`: `builder.Services.AddHostedService<AnomalyDetectionService>()`

#### Frontend
- `Dashboard.tsx`: `AnomalyNotification` interface, anomaly alerts panel in AdminDashboard; severity filter pills (all/warning/critical); per-row dismiss button; relative timestamp; panel hidden when 0 alerts
- `Notifications.tsx`: `notifIcon(type)` helper, red pulsing dot for anomaly type (5), distinct icon per notification type

**All 52 backend tests passing · 0 TypeScript errors**

### Commits
- `91671ee` — feat: Sprint 20 — Anomaly Detection & Alerts

---

## Pending For Next Session

> Last updated: Session 17 (2026-03-17). Sprints 13–20 fully merged to master.

### Priority 1 — Next Sprint
Start **Sprint 21 — Saved & Scheduled Reports + True Export** on branch `feature/sprint-21-saved-reports`

### Phase 3 Roadmap Status
1. **Sprint 13** ✅ — User Profile & Self-Service
2. **Sprint 14** ✅ — Bulk Timesheet Submission
3. **Sprint 15** ✅ — Manager Team Status Board + UX Audit
4. **Sprint 16** ✅ — Task-Level Timer
5. **Sprint 17** ✅ — Project Budget Burn
6. **Sprint 18** ✅ — Recurring Entry Templates
7. **Sprint 19** ✅ — Leave Team Calendar
8. **Sprint 20** ✅ — Anomaly Detection & Alerts (merged PR #40 → `7ce1d02`)
9. **Sprint 21** — Saved & Scheduled Reports (`feature/sprint-21-saved-reports`)
10. **Sprint 22** — Approval Delegation (`feature/sprint-22-approval-delegation`)
11. **Sprint 23** — Command Palette (`feature/sprint-23-command-palette`)
12. **Sprint 24** — Mobile PWA (`feature/sprint-24-mobile-pwa`)
13. **Sprint 25** — Dark Mode (`feature/sprint-25-dark-mode`)

**Rules:** Backend-first on every sprint. Separate branch per sprint. Merge to master only after manual testing approval.

---

## Known Issues / Gotchas

- **EF Core 9 dual-provider in tests:** The fix in `CustomWebApplicationFactory.cs` removes `IDbContextOptionsConfiguration<TimeSheetDbContext>` service descriptors by name match (`d.ServiceType.Name.StartsWith("IDbContextOptionsConfiguration")`). Do not revert this — it will break all 35 tests.
- **net10.0 only:** The dev machine only has .NET 10 runtime installed, not .NET 8. Both `.csproj` files target `net10.0`. Do not downgrade.
- **`gh` CLI not installed:** GitHub CLI (`gh`) is not available on this machine. All GitHub operations (PR creation, etc.) must be done via browser or by installing `gh`.
- **RefreshTokenCleanupService uses `ExecuteDeleteAsync`:** This is an EF Core 7+ bulk delete. Requires SQL Server provider in production (InMemory does not support it — the service uses try/catch to swallow the InMemory error).
- **`AuditService.WriteAsync` does NOT call `SaveChangesAsync`:** The caller is responsible. This is intentional so audit log entries are part of the same transaction as the main entity change.

---

## Session 18 — Tailwind Migration Complete + Clean Architecture Plan (2026-03-19)

### What Was Done

#### Tailwind CSS v4 Migration — Completed & Merged
- All 10 migration sessions (A–J) completed across previous sessions.
- **Session G (this session):** Migrated `Profile.tsx` — ToastStack, PwdField, camera overlay (`group`/`group-hover`), ToggleRow dynamic bg/opacity/knob kept as `style={{}}`.
- **Sessions H, I, J (parallel subagents):** Migrated `Leave.tsx`, `Dashboard.tsx`, `Timesheets.tsx` simultaneously.
  - `Leave.tsx`: Removed 130-line PAGE_STYLES, appended `lv-*` classes to design-system.css
  - `Dashboard.tsx`: Removed all `onMouseEnter/Leave` handlers; `dash-*` CSS classes added
  - `Timesheets.tsx`: Removed 758-line PAGE_STYLES; `ts-*` CSS classes added
- **Merged** `TimesheetV1.0_Tailwind` → `master` via no-ff merge commit `6ca488b` (22 files, −2565 lines removed, 886 lines added to design-system.css).
- **Bug fix (post-merge):** CSS reset `*, *::before, *::after { padding: 0 }` was unlayered, beating all Tailwind `@layer utilities` padding/margin utilities. Fixed by wrapping the reset in `@layer base` — commit `6ca488b`.

#### Clean Architecture Migration — Plan Created
- Evaluated current .NET backend: CRUD-first anemic domain model, 21 controllers with direct DbContext access, 10 services (inconsistently applied), no repository pattern, no CQRS.
- Designed full Layered Clean Architecture plan:
  - `TimeSheet.Domain` — Entities with behavior, Value Objects, Domain Events, Repository interfaces, Exceptions
  - `TimeSheet.Application` — MediatR CQRS (Commands/Queries), FluentValidation pipeline, Result<T> pattern, ICurrentUserService
  - `TimeSheet.Infrastructure` — EF Core (moved from API), Repository implementations, UnitOfWork with domain event dispatch
  - `TimeSheet.Api` — Thin controllers (8 lines each), composition root only
- 6-phase migration strategy: Scaffold → Domain Enrichment → Infrastructure → Application (feature by feature) → Domain Events → Tests
- **Zero downtime migration:** Each phase leaves the app fully functional; all existing API routes unchanged; no frontend impact.

### Commits
- `89dc8bc` — style: migrate Profile.tsx to Tailwind (Session G)
- `7c88611` — style: migrate Leave.tsx to Tailwind (Session H) [parallel agent]
- `975a4c6` — style: migrate Timesheets.tsx to Tailwind (Session J) [parallel agent]
- `7c0ddc4` — style: migrate Dashboard.tsx to Tailwind (Session I) [parallel agent]
- Merge commit — feat: complete Tailwind CSS v4 migration (Sessions A–J)
- `6ca488b` — fix: wrap CSS reset in @layer base to restore Tailwind padding/margin utilities

---

## Pending For Next Session

> Last updated: Session 18 (2026-03-19).

### 🔴 Priority 1 — Clean Architecture Migration (NEW — supersedes Sprint 21)
Start **Phase 1: Solution Scaffold** on branch `feature/clean-architecture`

See `PROJECT_TASKS.md` Epic E-CA for full task breakdown.

**Phase order:**
1. **Phase 1** — Create solution structure, project references, base types (Entity, Result<T>, IUnitOfWork)
2. **Phase 2** — Move & enrich domain entities; add Value Objects, Domain Events, Exceptions
3. **Phase 3** — Infrastructure layer (Repositories, UnitOfWork, services moved from API)
4. **Phase 4** — Application layer, feature by feature (Auth → Timesheets → Approvals → Leave → Reports → Admin)
5. **Phase 5** — Domain events wired through UnitOfWork.SaveChangesAsync
6. **Phase 6** — Unit tests (Domain + Application handlers)

### Sprint Roadmap (on hold during CA migration)
Sprints 21–25 remain planned but are deprioritized until Clean Architecture is in place.
New features built on the clean architecture will be far easier to implement and test.

9. **Sprint 21** — Saved & Scheduled Reports (`feature/sprint-21-saved-reports`)
10. **Sprint 22** — Approval Delegation
11. **Sprint 23** — Command Palette
12. **Sprint 24** — Mobile PWA
13. **Sprint 25** — Dark Mode

---

## Known Issues / Gotchas

- **EF Core 9 dual-provider in tests:** Fix in `CustomWebApplicationFactory.cs` — do not revert.
- **net10.0 only:** Both `.csproj` files target `net10.0`. Do not downgrade.
- **`gh` CLI not installed:** GitHub operations via browser only.
- **RefreshTokenCleanupService uses `ExecuteDeleteAsync`:** InMemory provider swallows the error via try/catch — intentional.
- **`AuditService.WriteAsync` does NOT call `SaveChangesAsync`:** Caller is responsible — intentional (same transaction).
- **Tailwind v4 CSS layers:** All custom CSS resets must stay inside `@layer base`. Unlayered CSS beats `@layer utilities` — never add unlayered `padding` or `margin` rules to design-system.css.

---

## Session 19 — Clean Architecture Phase 1: Solution Scaffold (2026-03-20)

### What Was Done

#### Branch
All work on `feature/clean-architecture`. **Do NOT merge to master until all 6 phases are complete and user has manually tested and approved.** User will raise the PR manually.

#### CA-001–006: Project creation & solution wiring
- Created 5 new projects via `dotnet new`:
  - `src/TimeSheet.Domain/` (classlib, net10.0, zero NuGet deps)
  - `src/TimeSheet.Application/` (classlib, net10.0)
  - `src/TimeSheet.Infrastructure/` (classlib, net10.0)
  - `tests/TimeSheet.Domain.Tests/` (xunit, net10.0)
  - `tests/TimeSheet.Application.Tests/` (xunit, net10.0)
- Added all 5 to `TimeSheet.sln`
- Project references set per dependency rule:
  - Application → Domain
  - Infrastructure → Domain + Application
  - Api → Application + Infrastructure
  - Domain.Tests → Domain
  - Application.Tests → Application
- NuGet packages added:
  - Application: MediatR 12.4.1, FluentValidation.DependencyInjectionExtensions 11.11.0, Mapster 7.4.0, Microsoft.Extensions.Logging.Abstractions 9.0.0, Microsoft.Extensions.DependencyInjection.Abstractions 9.0.0
  - Infrastructure: EF Core 9.0.0, EF Core SqlServer 9.0.0, MediatR 12.4.1, Microsoft.Extensions.* 9.0.0
  - Application.Tests: Moq 4.20.72, FluentAssertions 7.2.0

#### CA-007, CA-009: Domain base types (parallel agent)
- `src/TimeSheet.Domain/Common/IDomainEvent.cs` — plain marker interface (no MediatR dep in Domain)
- `src/TimeSheet.Domain/Common/Entity.cs` — `Guid Id` + domain events list + `AddDomainEvent` / `ClearDomainEvents`
- `src/TimeSheet.Domain/Common/AuditableEntity.cs` — extends Entity with `CreatedAtUtc` / `UpdatedAtUtc`
- `src/TimeSheet.Domain/Interfaces/IUnitOfWork.cs` — `SaveChangesAsync` contract
- `src/TimeSheet.Domain/Exceptions/` — `DomainException` (base), `InvalidStateTransitionException`, `InsufficientLeaveBalanceException`

#### CA-008, CA-010–013: Application layer (parallel agent)
- `Common/Models/Result.cs` — `Result` + `Result<T>` with `ResultStatus` enum (Success, NotFound, Forbidden, Validation, Conflict, Error)
- `Common/Interfaces/ICurrentUserService.cs` — `UserId`, `Username`, `Role`, `IsAdmin`, `IsManager`, `IsManagerOf(Guid)`
- `Common/Interfaces/IDateTimeProvider.cs` — `UtcNow`, `TodayUtc`
- `Common/Exceptions/` — `ValidationException`, `NotFoundException`, `ForbiddenException`
- `Common/Behaviors/` — `LoggingBehavior`, `PerformanceBehavior`, `ValidationBehavior` (MediatR 12.x signature: `next()` not `next(ct)`)
- `DependencyInjection.cs` — `AddApplication()` registers MediatR + all 3 behaviors + FluentValidation validators

#### CA-014, CA-015: Infrastructure stub + API wiring (parallel agent)
- `src/TimeSheet.Infrastructure/Services/DateTimeProvider.cs` — implements `IDateTimeProvider`
- `src/TimeSheet.Infrastructure/DependencyInjection.cs` — `AddInfrastructure()` stub (registers `IDateTimeProvider`; repositories added in Phase 3)
- `apps/api/Extensions/ResultExtensions.cs` — `ToActionResult()` overloads for `Result` and `Result<T>`
- `apps/api/Program.cs` — added `builder.Services.AddApplication()` + `builder.Services.AddInfrastructure(builder.Configuration)`

### Result
- **52/52 tests passing**
- **0 build errors** (file-lock warnings are harmless — dev server was running)
- All existing API behaviour unchanged

### Commits on `feature/clean-architecture`
- `d43d3a9` — feat(domain): Entity, IDomainEvent, IUnitOfWork, exceptions (CA-007, CA-009)
- `24b176a` — feat(application): Result<T>, interfaces, exceptions, behaviors, DI (CA-008, CA-010–013)
- `78817ea` — feat(infra+api): DateTimeProvider, Infrastructure DI, ResultExtensions, Program.cs wiring (CA-013–015)

---

## Session 20 — Clean Architecture Phase 2: Domain Enrichment (2026-03-20)

### What Was Done

#### Branch
All work on `feature/clean-architecture`.

#### CA-020, CA-021: Entity + Enum move (parallel agent)
- 25 entity models moved from `apps/api/Models/` → `src/TimeSheet.Domain/Entities/` with namespace `TimeSheet.Domain.Entities`
- 5 enums extracted to `src/TimeSheet.Domain/Enums/`: `TimesheetStatus`, `WorkSessionStatus`, `LeaveRequestStatus`, `ApprovalActionType`, `NotificationType`
- Added `Cancelled = 3` to `LeaveRequestStatus`
- `apps/api/GlobalUsings.cs` + `apps/api.tests/GlobalUsings.cs` added — `global using TimeSheet.Domain.Entities/Enums`
- Removed `using TimeSheet.Api.Models;` from all 26 Api files + 9 test files
- Original hollowed-out stubs deleted in cleanup commit

#### CA-025: Value Objects (parallel agent)
- `src/TimeSheet.Domain/ValueObjects/DateRange.cs` — `Start`, `End`, validation, `Overlaps()`, `Contains()`, `Length`
- `src/TimeSheet.Domain/ValueObjects/Duration.cs` — wraps `TimeSpan`, factory methods, arithmetic
- `src/TimeSheet.Domain/ValueObjects/WorkHours.cs` — validates 0–24h, `Add()`, `IsWithin()`

#### CA-027: Domain Events (parallel agent)
- `src/TimeSheet.Domain/Events/TimesheetSubmittedEvent.cs` — `(TimesheetId, UserId, WorkDate)`
- `src/TimeSheet.Domain/Events/TimesheetApprovedEvent.cs` — `(TimesheetId, ApproverId)`
- `src/TimeSheet.Domain/Events/TimesheetRejectedEvent.cs` — `(TimesheetId, ApproverId, Comment)`
- `src/TimeSheet.Domain/Events/TimesheetPushedBackEvent.cs` — `(TimesheetId, ApproverId, Comment)`
- `src/TimeSheet.Domain/Events/LeaveRequestApprovedEvent.cs` — `(LeaveRequestId, ApproverId, UserId, ...)`
- `src/TimeSheet.Domain/Events/LeaveRequestRejectedEvent.cs` — `(LeaveRequestId, ApproverId, UserId, ...)`
- `src/TimeSheet.Domain/Events/WorkSessionCheckedOutEvent.cs` — `(WorkSessionId, UserId, CheckOutAtUtc)`

#### CA-028: Repository Interfaces (parallel agent)
- `src/TimeSheet.Domain/Interfaces/ITimesheetRepository.cs`
- `src/TimeSheet.Domain/Interfaces/IUserRepository.cs`
- `src/TimeSheet.Domain/Interfaces/ILeaveRepository.cs`
- `src/TimeSheet.Domain/Interfaces/IProjectRepository.cs`
- `src/TimeSheet.Domain/Interfaces/INotificationRepository.cs`

#### CA-022: Timesheet behaviors (parallel agent)
- `Timesheet` now inherits `Entity` base
- `Submit()` — Draft→Submitted + `TimesheetSubmittedEvent`
- `Approve(approverId)` — Submitted→Approved + `TimesheetApprovedEvent`
- `Reject(approverId, comment)` — Submitted→Rejected + `TimesheetRejectedEvent`
- `PushBack(approverId, comment)` — Submitted→Draft + `TimesheetPushedBackEvent`
- All methods throw `InvalidStateTransitionException` on wrong state

#### CA-023: LeaveRequest behaviors (parallel agent)
- `LeaveRequest` now inherits `Entity` base
- `Approve(approverId)` — Pending→Approved + `LeaveRequestApprovedEvent`
- `Reject(approverId, comment)` — Pending→Rejected + `LeaveRequestRejectedEvent`
- `Cancel()` — Pending|Approved→Cancelled (no event)

#### CA-024: WorkSession behaviors (parallel agent)
- `WorkSession` now inherits `Entity` base
- `CheckOut(checkOutAtUtc)` — Active→Completed + `WorkSessionCheckedOutEvent`
- `AddBreak(startAtUtc)` — adds `BreakEntry`, throws if open break exists
- `EndBreak(endAtUtc)` — closes open break, throws if none found

#### CA-029 + CA-030: Unit tests + verification
- 22 domain unit tests in `tests/TimeSheet.Domain.Tests/`
  - `TimesheetTests.cs` (8 tests)
  - `LeaveRequestTests.cs` (7 tests)
  - `WorkSessionTests.cs` (7 tests)
- **52/52 integration tests still passing**

### Result
- **22 domain unit tests passing**
- **52/52 integration tests passing**
- **0 build errors**
- Phase 2 fully complete ✓

### Commits on `feature/clean-architecture` (Phase 2)
- `4d4413c` — feat(domain): domain events (CA-027)
- `a314698` — feat(domain): entity + enum move (CA-020, CA-021)
- `376ba34` — feat(domain): cleanup project files + model stubs
- `8a4485e` — feat(domain): WorkSession behaviors (CA-024)
- `0d77e26` — feat(domain): LeaveRequest behaviors (CA-023)
- `0512220` — feat(domain): Timesheet behaviors (CA-022)
- `a1a680a` — test(domain): unit tests for all entity behaviors (CA-029)

---

## Session 21 — Clean Architecture Phase 3: Infrastructure Layer (2026-03-20)

### What Was Done

#### CA-031 + CA-032: DbContext + Migrations moved
- `TimeSheetDbContext.cs` → `src/TimeSheet.Infrastructure/Persistence/` (namespace `TimeSheet.Infrastructure.Persistence`)
- 15 migration files → `src/TimeSheet.Infrastructure/Persistence/Migrations/`
- `DbInitializer.cs` → `src/TimeSheet.Infrastructure/Persistence/`
- GlobalUsings updated; `MigrationsAssembly("TimeSheet.Infrastructure")` set

#### CA-033: IEntityTypeConfiguration split
- 25 configuration files in `src/TimeSheet.Infrastructure/Persistence/Configurations/`
- `OnModelCreating` → `modelBuilder.ApplyConfigurationsFromAssembly(...)`

#### CA-034: BaseRepository + 5 specific repositories
- `BaseRepository<T>` + `TimesheetRepository`, `UserRepository`, `LeaveRepository`, `ProjectRepository`, `NotificationRepository`
- All implement their domain interfaces

#### CA-035: UnitOfWork with domain event dispatch
- Collects events from tracked `Entity` instances, saves, then dispatches via `publisher.Publish((dynamic)event)`
- Domain stays free of MediatR

#### CA-036 + CA-037 + CA-040: Services + Background Jobs moved
- `TokenService`, `PasswordHasher`, `AttendanceCalculationService`, `AuditService`, `NotificationService` → `Infrastructure/Services/`
- `RefreshTokenCleanupService`, `NotificationSchedulerService`, `AnomalyDetectionService` → `Infrastructure/BackgroundJobs/`

#### CA-038: CurrentUserService
- `CurrentUserService` implements `ICurrentUserService` — reads JWT claims via `IHttpContextAccessor`

#### CA-041 + CA-042: DI consolidated + tests pass
- All registrations in `AddInfrastructure()` — `Program.cs` now minimal
- **52/52 integration tests passing** ✓

### Commits (Phase 3)
- `f8ca647` — feat(infra): move DbContext + Migrations (CA-031, CA-032)
- `01ae7f3` — feat(infra): EF configs + repositories + UnitOfWork (CA-033–035)
- `cca0bdd` — feat(infra): services + DI consolidation (CA-036–042)

---

## Session 26 — Clean Architecture Phase 7: Reference Data CQRS (2026-03-26)

### What Was Done

#### Branch
All work on `feature/clean-architecture`.

#### CA-097–103: Reference Data CQRS (Roles, TaskCategories, Holidays, Departments, WorkPolicies)

**Domain interfaces (5 new):**
- `IRoleRepository` — GetAll, ExistsAsync, Add
- `ITaskCategoryRepository` — GetActive, GetAll, ExistsAsync, GetById, Add, Remove
- `IHolidayRepository` — GetByYear, GetById, Add, Remove
- `IDepartmentRepository` — GetAll, ExistsAsync, Add
- `IWorkPolicyRepository` — GetAll, GetById, ExistsAsync, Add, Remove

**Infrastructure repositories (5 new — NotificationRepository pattern, plain `DbSet<T>` field):**
- `RoleRepository`, `TaskCategoryRepository`, `HolidayRepository`, `DepartmentRepository`, `WorkPolicyRepository`

**Application/ReferenceData/Queries (10 files):**
- `GetRolesQuery` + Handler
- `GetTaskCategoriesQuery(AdminAll)` + Handler (single query handles both active-only and admin-all)
- `GetHolidaysQuery(Year?)` + Handler (uses `IDateTimeProvider` for default year)
- `GetDepartmentsQuery` + Handler
- `GetWorkPoliciesQuery` + Handler

**Application/ReferenceData/Commands (18 files):**
- Role: `CreateRoleCommand` + Handler
- TaskCategory: `CreateTaskCategoryCommand`, `UpdateTaskCategoryCommand`, `DeleteTaskCategoryCommand` + Handlers
- Holiday: `CreateHolidayCommand`, `UpdateHolidayCommand`, `DeleteHolidayCommand` + Handlers
- Department: `CreateDepartmentCommand` + Handler
- WorkPolicy: `CreateWorkPolicyCommand`, `UpdateWorkPolicyCommand`, `DeleteWorkPolicyCommand` + Handlers

**DI:** 5 new `AddScoped` in `AddInfrastructure()`

**Slimmed controllers (4):**
- `RolesController` — ISender only; removed DbContext
- `TaskCategoriesController` — ISender only; removed DbContext
- `HolidaysController` — ISender only; removed DbContext + ILogger
- `MastersController` — ISender only; removed DbContext

### Result
- **74/74 tests passing** (52 integration + 22 domain), **0 build errors**

### Commits
- `cbc65eb` — feat(application): Phase 7 — Reference data CQRS (Roles, TaskCategories, Holidays, Masters)

---

## Pending For Next Session

> Last updated: Session 26 (2026-03-26).

### 🔴 Priority — Manual QA + PR to master
Branch: `feature/clean-architecture` is now ready for QA.

**Remaining deferred work (acceptable before PR):**
- `LeaveController`: calendar/team-calendar/conflicts/team-on-leave endpoints still use EF directly (complex queries)
- `TimesheetsController.DeleteEntry`: minimal EF lookup still inline
- CA-095: Final architecture review
- CA-096: README update

**To merge:**
1. User runs the app manually and smoke-tests the 4 slimmed controller groups
2. User raises PR: `feature/clean-architecture` → `master`
3. User reviews and merges manually — **never auto-merge**

### Merge Policy
- All CA work stays on `feature/clean-architecture`
- User will manually test, raise PR, and merge
- **Never auto-merge CA work to master**

### Sprint Roadmap (still on hold)
Sprints 21–25 remain deferred until CA migration is merged to master.

---

## Known Issues / Gotchas

- **EF Core 9 dual-provider in tests:** Fix in `CustomWebApplicationFactory.cs` — do not revert.
- **net10.0 only:** Both `.csproj` files target `net10.0`. Do not downgrade.
- **`gh` CLI not installed:** GitHub operations via browser only.
- **RefreshTokenCleanupService uses `ExecuteDeleteAsync`:** InMemory provider swallows the error via try/catch — intentional.
- **`AuditService.WriteAsync` does NOT call `SaveChangesAsync`:** Caller is responsible — intentional (same transaction).
- **Tailwind v4 CSS layers:** All custom CSS resets must stay inside `@layer base`.
- **MediatR 12.x pipeline behavior signature:** `RequestHandlerDelegate<TResponse>` is a zero-arg delegate — call `next()` not `next(cancellationToken)`.
- **CA branch policy:** All Clean Architecture work (Phases 1–6) stays on `feature/clean-architecture`. User tests manually and raises PR to master themselves.
- **QuestPDF namespace gotchas:** `PageDescriptor` is in `QuestPDF.Fluent`, `PageSizes` is in `QuestPDF.Helpers`. All extension methods (Column, PaddingTop, AlignCenter, FontSize, etc.) require `using QuestPDF.Fluent;`. `table.Header()` takes a callback `Action<TableCellDescriptor>`, not a chained call. `Colors.Grey` has `Lighten1–5`/`Medium`/`Darken1–4` — there is no `Light`.
- **QuestPDF vs ASP.NET conflict:** `container.Page()` conflicts with `UrlHelperExtensions.Page` from `Microsoft.AspNetCore.Mvc`. Fix: extract page body to a separate `private static void BuildPdfPage(QuestPDF.Fluent.PageDescriptor page, ...)` method.

---

## Session 27 — Sprint 21: Saved & Scheduled Reports + True Export (2026-03-26)

### What Was Done

#### Branch
All Sprint 21 work on `feature/sprint-21-saved-reports`.

#### TSK-RPT-008/009: True Excel and PDF export (ReportsController)
- Added ClosedXML 0.102.3 and QuestPDF 2025.1.0 packages to both `TimeSheet.Api.csproj` and `TimeSheet.Infrastructure.csproj`
- `ReportsController.ExportReport()`: replaced stub CSV-only response with real Excel (ClosedXML) and PDF (QuestPDF Community) generation
  - `BuildCsv()` — streams RFC-4180 CSV via `StringBuilder`
  - `BuildExcel()` — ClosedXML workbook with bold header row, auto-width columns, returns `.xlsx`
  - `BuildPdf()` / `BuildPdfPage()` — QuestPDF Community; A4 Landscape, styled header + alternating-row table, page footer

#### TSK-SVR-001–007: SavedReports CQRS backend
**Domain:**
- `SavedReport` entity (inherits `Entity`, `ScheduleType` enum, `RecipientEmailsJson`, `LastRunAt`, nav prop to `User`)
- `ScheduleType` enum: `None=0`, `Weekly=1`, `Monthly=2`
- `ISavedReportRepository`: `GetByUserAsync`, `GetByIdAsync`, `Add`, `Remove`

**Application (CQRS):**
- `GetSavedReportsQuery` + Handler — returns `IReadOnlyList<SavedReportDto>` for current user
- `CreateSavedReportCommand` + Handler
- `UpdateSavedReportCommand` + Handler — ownership check (`Forbidden` if not owner)
- `DeleteSavedReportCommand` + Handler — ownership check

**Infrastructure:**
- `SavedReportRepository` (NotificationRepository pattern — plain `DbSet<SavedReport>` field)
- `SavedReportConfiguration` — `SavedReports` table, index on `UserId`
- `TimeSheetDbContext`: `public DbSet<SavedReport> SavedReports => Set<SavedReport>();`
- `ReportSchedulerService` (`IHostedService`) — hourly background job, Weekly (matching DayOfWeek) and Monthly (1st of month) schedule logic, stub email delivery
- EF migration: `20260326182503_Sprint21_SavedReports`
- DI: `ISavedReportRepository → SavedReportRepository`, `ReportSchedulerService` hosted service

**API:**
- `SavedReportsController` — GET/POST/PUT/DELETE `/api/v1/reports/saved`
- `SavedReportRequest` DTO added to `ReportDtos.cs`

#### TSK-SVR-008–010: Saved Reports UI (Reports.tsx)
- "Save Report" button in filter bar — opens Save/Edit modal
- Save modal: name, schedule type (None/Weekly/Monthly), day of week (if Weekly), hour, recipient emails
- "Manage Saved Reports" button — opens manage modal with list, edit, inline delete-confirm
- `SavedReport`, `SavedReportPayload` TypeScript interfaces added to `types.ts`
- Full CRUD wired to `/api/v1/reports/saved`

### Result
- **74/74 tests passing** (52 integration + 22 domain), **0 build errors**

### Commits
- `07bfaa5` — feat(sprint-21): Saved & Scheduled Reports + true Excel/PDF export

---

---

## Session 28 — Sprint 22: Approval Delegation (2026-03-27)

### What Was Done

#### Branch
All Sprint 22 work on `feature/sprint-22-approval-delegation`.

#### TSK-DEL-001: Domain
- `ApprovalDelegation` entity: `FromUserId`, `ToUserId`, `FromDate`, `ToDate`, `IsActive`, `CreatedAtUtc`
- `IApprovalDelegationRepository`: GetActiveForUser, GetActiveDelegationsForDelegate, GetById, HasOverlap, Add
- `ApprovalAction.DelegatedFromUserId` (nullable) — records when a delegate acted

#### TSK-DEL-002–004: Application CQRS
- `GetDelegationQuery` + Handler — returns current user's active outgoing delegation
- `CreateDelegationCommand` + Handler — validates toUser is manager/admin, checks date overlap
- `RevokeDelegationCommand` + Handler — ownership check, sets `IsActive = false`
- `DelegationDto` record

#### TSK-DEL-005: Modified GetPendingTimesheetsQueryHandler
- Also fetches active delegations for current user as delegate
- For each delegation, fetches pending timesheets of the `fromUser` (delegating manager)
- Returns `PendingTimesheetItem` with `DelegatedFromUsername` set

#### TSK-DEL-006: Modified Approve/Reject/PushBack handlers
- If current user is not direct manager/admin, checks active delegations
- If delegate match found, action is allowed and `DelegatedFromUserId` recorded in `ApprovalAction`

#### Infrastructure
- `ApprovalDelegationRepository` (plain DbSet pattern)
- `ApprovalDelegationConfiguration` (EF config, FK to User×2, indexes)
- `TimeSheetDbContext`: `ApprovalDelegations` DbSet
- EF migration: `Sprint22_ApprovalDelegation`
- DI registered

#### API
- `ApprovalsController`: GET/POST `delegation`, DELETE `delegation/{id}`
- `CreateDelegationRequest` DTO

#### TSK-DEL-007–009: Frontend
- `Approvals.tsx`: Delegate Approvals modal (delegate-to select, date range, save/cancel), active delegation banner (shows when user is acting as delegate), "via [manager]" badge on each delegated item, Revoke inline button
- `types.ts`: `ApprovalDelegation` interface added

### Result
- **74/74 tests passing**, **0 build errors**

### Commits
- `af2c41a` — feat(sprint-22): Approval Delegation — delegate, revoke, enforce in actions

---

## Pending For Next Session

> Last updated: Session 28 (2026-03-27).

### Sprint 22 — complete on `feature/sprint-22-approval-delegation`
All Sprint 22 tasks are done. Branch is ready to raise a PR to master.

**To merge:**
1. User smoke-tests: create delegation, see delegated items with "via" badge, approve as delegate, revoke
2. User raises PR: `feature/sprint-22-approval-delegation` → `master`
3. User reviews and merges manually

### Sprint Roadmap
| Sprint | Feature |
|--------|---------|
| 23 | Command Palette |
| 24 | Mobile PWA |
| 25 | Dark Mode |

---

## Session 29 — Sprint 23: Command Palette (2026-03-27)

### What Was Done

#### Branch
`feature/sprint-23-command-palette`

#### TSK-CMD-001–007: Command Palette (pure frontend, no backend)

**New files:**
- `CommandPalette.tsx` — Cmd+K overlay; search input; grouped Navigate/Actions commands; role-aware (admin: New User, New Project; manager/admin: Bulk Approve); ↑/↓ keyboard navigation; Enter to execute; Esc to close; footer hint bar
- `ShortcutsPanel.tsx` — `?` key opens shortcut reference showing all 9 shortcuts with Global/view-name scope labels

**Modified files:**
- `AppShell.tsx` — Search button in topbar (`⌘K` hint); global keydown handler: Cmd+K (palette), `?` (shortcuts), `N`/`S` (timesheets only), `A` (approvals only), `/` (focus search); mounts `<CommandPalette>` and `<ShortcutsPanel>`
- `Timesheets.tsx` — listens `cmd:new-entry` → open entry form, `cmd:submit-week` → open submit modal
- `Approvals.tsx` — listens `cmd:bulk-approve` → trigger bulk approve when items selected

### Result
- 0 TypeScript errors, 0 build errors

### Commits
- `585e20b` — feat(sprint-23): Command Palette + keyboard shortcuts

---

---

## Session 30 — UI Audit Quick Wins + Date Range Redesign (2026-04-04)

### Branch
`feature/BackendAPIPagedResponse`

### What Was Done

#### Quick wins — shared component library cleanup (continued from prior sessions)

**1. Empty States consistency (#4)**
- `ServerDataTable.tsx` — replaced plain `<span>{emptyText}</span>` with `EmptyState` (when no search) or `EmptySearch` (when search active); padding bumped to 40px
- `LeavePolicies.tsx` — fixed raw `empty-row` class on leave types table → styled `<span>` in centered `<td>`
- Import `EmptyState, EmptySearch` added to ServerDataTable

**2. AppDatePicker (#5) — no new component needed**
- `TimesheetExportModal.tsx` was the only file still using raw `<input type="date">` with inline styles
- Replaced with `<AppInput type="date">` + added `import { AppInput } from "./ui"`
- All other files (Leave, Approvals, Reports, Holidays, Timesheets) already used `AppInput type="date"`

**3. AuditLogViewer improvements (#6)**
- **Date preset filter UI was missing** — `DATE_PRESETS`, `preset`, `customFrom`/`customTo` states were wired in data fetching but never rendered in the UI; now rendered
- Added `DateRangeFilter` component (pill buttons + animated custom inputs reveal)
- Replaced local `AVATAR_COLORS` array + `avatarColor` function with shared `avatarColor` from `utils/avatar`
- Removed dead `pageWindow` computed variable (unused since `AppPagination` handles pagination)
- Toolbar "Clear" button consolidated to call `clearFilters()` (was duplicating the logic inline)

**4. DateRangeFilter redesign — smooth transition**
- Replaced the plain `FilterSelect` (native `<select>`) approach with a proper `DateRangeFilter` component
- **Pill row**: `All time · Today · Last 7 days · Last 30 days · This month · Custom` — rounded pill buttons, active = brand-500 fill + indigo glow shadow, hover = border highlight
- **Animated reveal**: custom date inputs use `grid-template-rows: 0fr → 1fr` + `opacity 0 → 1` CSS transition (the trick for animating height:auto)
- **Arrow connector**: small inline SVG arrow between the two date inputs
- **"Clear dates"** link appears inside custom row only when dates are set
- Date range row placed in its own section below the search/filter toolbar with a subtle border separator

### Files Modified
- `apps/web/src/components/ui/ServerDataTable.tsx`
- `apps/web/src/components/Admin/LeavePolicies.tsx`
- `apps/web/src/components/TimesheetExportModal.tsx`
- `apps/web/src/components/Admin/AuditLogViewer.tsx`

### Pending For Next Session

> Last updated: Session 30 (2026-04-04). Branch: `feature/BackendAPIPagedResponse`

#### Remaining UI audit items:
| # | Item | Status |
|---|------|--------|
| 1 | Reports Page — No Charts (High Impact) | ❌ not started |
| 2 | Admin Hub redesign — plain link grid needs icons/counts/status | ❌ not started |
| 3 | Profile Page — Templates Tab Incomplete | ❌ not started |

#### Sprint Roadmap (on hold)
| Sprint | Feature |
|--------|---------|
| 24 | Mobile PWA |
| 25 | Dark Mode |
