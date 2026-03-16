# Timesheet Management System — Project Task Plan

This file translates the provided BRD/FRS into implementation-ready tasks for the repository.

## How to use this plan
- Track work by Epic → Feature → Task.
- Keep task IDs stable for issue tracking.
- Mark status with: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`.
- Recommended branch naming: `feature/<featureNameOrID>` for feature work and `bugfix/<bugNameOrID>` for bug work.
- Before merge, complete code review and run lint, tests, and build to ensure no breaking changes.

---

## Epic E1 — Foundation and Access

### E1-F1 Authentication and Session
- [x] **TSK-AUTH-001** Create backend auth module skeleton (`/auth`) with layered architecture wiring.
- [x] **TSK-AUTH-002** Implement login endpoint (email/username + password).
- [x] **TSK-AUTH-003** Add password hashing + verification service.
- [x] **TSK-AUTH-004** Implement JWT token generation and validation.
- [x] **TSK-AUTH-005** Add refresh token strategy (or short-lived token policy).
- [x] **TSK-AUTH-006** Add secure auth middleware and unauthorized response standards.
- [x] **TSK-AUTH-007** Build React login page and error states.
- [x] **TSK-AUTH-008** Add protected route handling in frontend.
- [x] **TSK-AUTH-009** Add logout behavior and token/session cleanup.
- [x] **TSK-AUTH-010** Add auth integration tests (valid login, invalid login, unauthorized route).

### E1-F2 Roles and Permissions
- [x] **TSK-RBAC-001** Define role entities and seed baseline roles.
- [x] **TSK-RBAC-002** Implement user-role mapping table and APIs.
- [x] **TSK-RBAC-003** Implement permission enforcement attributes/policies on APIs.
- [x] **TSK-RBAC-004** Add frontend role guards for menu/routes/actions.
- [x] **TSK-RBAC-005** Add test coverage for access control matrix.

### E1-F3 User and Hierarchy Management
- [x] **TSK-USER-001** Create User, Department, and WorkPolicy master schemas.
- [x] **TSK-USER-002** Implement user CRUD APIs with validation (unique email/employee ID).
- [x] **TSK-USER-003** Implement reporting manager mapping and retrieval APIs.
- [x] **TSK-USER-004** Build admin user management UI (list/search/filter/create/edit/activate/deactivate).
- [x] **TSK-USER-005** Enforce "inactive users cannot submit timesheets".
- [x] **TSK-USER-006** Add audit logging for user admin actions.

---

## Epic E2 — Attendance and Break Tracking

### E2-F1 Work Sessions
- [x] **TSK-ATT-001** Create WorkSession schema and status enums.
- [x] **TSK-ATT-002** Implement check-in API with duplicate active session prevention.
- [x] **TSK-ATT-003** Implement check-out API with validation.
- [x] **TSK-ATT-004** Support multi-session day aggregation per policy.
- [x] **TSK-ATT-005** Implement attendance exception flagging for missing checkout.
- [x] **TSK-ATT-006** Build attendance widget/UI for daily status.
- [x] **TSK-ATT-007** Build attendance history view with date range filters.
- [x] **TSK-ATT-008** Add unit tests for check-in/out rules and exception cases.

### E2-F2 Break Management
- [x] **TSK-BRK-001** Create BreakEntry schema.
- [x] **TSK-BRK-002** Implement start break API (validate active session).
- [x] **TSK-BRK-003** Implement end break API (calculate duration, prevent overlap).
- [x] **TSK-BRK-004** Implement manual break edit API with policy restrictions.
- [x] **TSK-BRK-005** Add break summary endpoints for dashboards/reports.
- [x] **TSK-BRK-006** Add break controls in attendance UI.
- [x] **TSK-BRK-007** Add tests for overlap and sequence validation rules.

### E2-F3 Attendance Calculation Engine
- [x] **TSK-CALC-001** Implement gross/lunch/extra-break/net calculation service.
- [x] **TSK-CALC-002** Apply fixed lunch deduction (45 mins) via configurable policy.
- [x] **TSK-CALC-003** Handle low-gross-duration edge cases with configurable behavior.
- [x] **TSK-CALC-004** Expose attendance summary DTO for frontend/reports.
- [x] **TSK-CALC-005** Add deterministic tests for sample calculations (09:00–18:00, 09:00–21:00).

---

## Epic E3 — Project and Task Masters

### E3-F1 Project Master
- [x] **TSK-PRJ-001** Create Project schema with required fields and statuses.
- [x] **TSK-PRJ-002** Implement project CRUD + archive APIs.
- [x] **TSK-PRJ-003** Implement project-member assignment APIs.
- [x] **TSK-PRJ-004** Enforce active project visibility in timesheet entry.
- [x] **TSK-PRJ-005** Build admin project management UI.
- [x] **TSK-PRJ-006** Add tests for date validations and archive behavior.

### E3-F2 Task Categories
- [x] **TSK-TASK-001** Create TaskCategory schema.
- [x] **TSK-TASK-002** Seed default task categories from FRS.
- [x] **TSK-TASK-003** Implement category CRUD APIs.
- [x] **TSK-TASK-004** Enforce active-only categories in timesheet forms.
- [x] **TSK-TASK-005** Build admin task category UI.

---

## Epic E4 — Timesheet Management

### E4-F1 Daily Entry
- [x] **TSK-TS-001** Create Timesheet and TimesheetEntry schemas.
- [x] **TSK-TS-002** Implement create/update/delete draft entry APIs.
- [x] **TSK-TS-003** Implement daily totals calculation endpoint.
- [x] **TSK-TS-004** Implement no-future-date validation.
- [x] **TSK-TS-005** Implement backdated edit window based on policy.
- [x] **TSK-TS-006** Build daily timesheet UI with add/edit/delete rows.
- [x] **TSK-TS-007** Display attendance summary and entered vs remaining minutes.

### E4-F2 Weekly View
- [x] **TSK-TS-008** Implement weekly aggregation API.
- [x] **TSK-TS-009** Build weekly grid UI with status per day.
- [x] **TSK-TS-010** Add week navigation within allowed limits.
- [x] **TSK-TS-011** Add optional copy previous day/week helper.

### E4-F3 Validation and Submission
- [x] **TSK-TS-012** Implement attendance vs timesheet mismatch comparison service.
- [x] **TSK-TS-013** Implement mismatch reason requirement when policy enabled.
- [x] **TSK-TS-014** Implement draft → submitted transition API.
- [x] **TSK-TS-015** Lock submitted records unless rejected/pushed back/unlocked.
- [x] **TSK-TS-016** Implement resubmission flow and status transitions.
- [x] **TSK-TS-017** Add validation and workflow tests for statuses.

---

## Epic E5 — Leave Management

### E5-F1 Leave Types and Requests
- [x] **TSK-LV-001** Create LeaveType and LeaveRequest schemas.
- [x] **TSK-LV-002** Implement leave type admin CRUD and seed data.
- [x] **TSK-LV-003** Implement apply leave API (full-day/half-day). *(Updated in session 7: frontend now sends `fromDate`/`toDate` range — backend must be updated to accept range and expand into per-day records)*
- [x] **TSK-LV-004** Prevent/flag overlapping leave requests.
- [x] **TSK-LV-005** Build leave apply/history UI. *(Redesigned in session 7 — see TSK-LV-015)*

### E5-F2 Leave Approval and Work Expectation
- [x] **TSK-LV-006** Implement manager leave approval/rejection API with comments.
- [x] **TSK-LV-007** Reflect approved leave in expected-hours logic.
- [x] **TSK-LV-008** Build manager leave approval list UI.
- [x] **TSK-LV-009** Add tests for full-day and half-day expectation adjustment.

### E5-F3 Leave Policy and Balance *(added session 7)*
- [x] **TSK-LV-010** Create `LeavePolicy` + `LeavePolicyAllocation` schemas; admin CRUD APIs (`GET/POST/PUT/DELETE /leave/policies`). *(DONE session 9)*
- [x] **TSK-LV-011** Implement leave balance tracking: `GET /leave/balance/my`, `GET /leave/balance/{userId}`. *(DONE session 9)*
- [x] **TSK-LV-012** Extend `POST /leave/requests` to accept `fromDate`/`toDate` date range; expand to per-day records server-side. *(DONE session 9)*
- [x] **TSK-LV-013** Implement `GET /leave/calendar?year=&month=` — return pending/approved/rejected leave dates for calendar widget. *(DONE session 9)*
- [x] **TSK-LV-014** Implement `GET /leave/team-on-leave` — return team members currently on leave or upcoming. *(DONE session 9)*
- [x] **TSK-LV-015** Implement `GET /leave/requests/my/grouped` — return history as date-range records (not per-day rows). *(DONE session 9)*
- [x] **TSK-LV-016** Build Leave Policy admin UI (`Admin/LeavePolicies.tsx`) — list/create/edit policies with per-type day allocations. *(DONE session 7)*
- [x] **TSK-LV-017** Extend Users create/edit form to assign a Leave Policy (`leavePolicyId`). *(DONE session 7)*
- [x] **TSK-LV-018** Build Leave page PulseHQ v3.0 redesign — balance cards, date-range form, grouped history table, mini calendar sidebar, Team on Leave panel. *(DONE session 7 — graceful fallback for unimplemented APIs)*

### E5-F4 Leave UX Polish & Bug Fixes *(added session 9)*
- [x] **TSK-LV-019** Fix 500 error on re-apply: delete rejected `LeaveRequest` rows before inserting new ones to avoid `UQ_LeaveRequests_UserDate` unique constraint violation. *(DONE session 9)*
- [x] **TSK-LV-020** Implement `DELETE /leave/requests/{id}` cancel endpoint — matches by `LeaveGroupId` or `Id`, enforces pending-only guard. *(DONE session 9)*
- [x] **TSK-LV-021** Leave history cards: human-readable date ranges, Re-apply/Cancel row actions, `ToDate < FromDate` validation error shown inline, admin "Apply on behalf of" dropdown. *(DONE session 9)*
- [x] **TSK-LV-022** Add Leave Types management section to `Admin/LeavePolicies.tsx` — inline form + table with Active/Inactive badges. *(DONE session 9)*

---

## Epic E6 — Approval Workflow

### E6-F1 Timesheet Approval Actions
- [x] **TSK-APR-001** Create ApprovalAction schema for audit/history.
- [x] **TSK-APR-002** Build manager pending timesheet list endpoint.
- [x] **TSK-APR-003** Implement approve action API.
- [x] **TSK-APR-004** Implement reject/push-back APIs with mandatory comments.
- [x] **TSK-APR-005** Build manager approval UI with filters and summaries. *(Redesigned in session 7 — see TSK-APR-008)*
- [x] **TSK-APR-006** Build approval history component for employee/manager views.
- [x] **TSK-APR-007** Add transition and authorization tests.

### E6-F2 Approvals UI Enhancement *(added session 7)*
- [x] **TSK-APR-008** Redesign Approvals page to PulseHQ v3.0 — KPI stat cards, tab filter (All/Timesheets/Leave), unified approval cards with colored left borders, inline reject form. *(DONE session 7)*
- [ ] **TSK-APR-009** Implement `GET /approvals/stats` — return `approvedThisMonth`, `rejectedThisMonth`, `avgResponseHours` for KPI cards. *(Frontend ready, backend pending)*

---

## Epic E7 — Dashboards and Analytics

### E7-F1 Employee Dashboard
- [x] **TSK-DSH-EMP-001** Build today attendance summary card.
- [x] **TSK-DSH-EMP-002** Build timesheet status and pending actions card.
- [x] **TSK-DSH-EMP-003** Build weekly hours and break summary widgets.
- [x] **TSK-DSH-EMP-004** Build project-wise effort chart.
- [x] **TSK-DSH-EMP-005** Build monthly compliance trend visualization.

### E7-F2 Manager Dashboard
- [x] **TSK-DSH-MGR-001** Build team present/on-leave/not-checked-in widgets.
- [x] **TSK-DSH-MGR-002** Build missing timesheets and pending approvals widgets.
- [x] **TSK-DSH-MGR-003** Build attendance vs timesheet mismatch view.
- [x] **TSK-DSH-MGR-004** Build team utilization summary.
- [x] **TSK-DSH-MGR-005** Build team project contribution summary.

### E7-F3 Management Dashboard
- [x] **TSK-DSH-MGMT-001** Build org effort by department/project visualizations.
- [x] **TSK-DSH-MGMT-002** Build billable vs non-billable and consultant vs internal summaries.
- [x] **TSK-DSH-MGMT-003** Build underutilized/overloaded indicators.
- [x] **TSK-DSH-MGMT-004** Build compliance/missing timesheet/overtime trends.

---

## Epic E8 — Reports and Export

### E8-F1 Reports
- [x] **TSK-RPT-001** Implement attendance summary report endpoint.
- [x] **TSK-RPT-002** Implement timesheet summary report endpoint.
- [x] **TSK-RPT-003** Implement project effort report endpoint.
- [x] **TSK-RPT-004** Implement leave and utilization reports.
- [x] **TSK-RPT-005** Implement common report filter framework (`ReportFilterRequest`, `BuildScopeAsync`, role-based user scoping).
- [x] **TSK-RPT-006** Build reports UI — 7-tab strip, date range filter, KPI cards, sortable columns, pagination, inline search, human-readable headers, status badges, utilization/balance bars, delta coloring, freshness indicator, scroll gradient, employee filter, rows-per-page selector, PDF/CSV/Excel export. *(Full redesign DONE session 10)*
- [x] **TSK-RPT-011** Implement Leave Balance report: `GET /reports/leave-balance` — reads `LeavePolicyAllocations` + approved `LeaveRequests` grouped by user+type; `LeaveBalanceReportRow` DTO. *(DONE session 10)*
- [x] **TSK-RPT-012** Implement Timesheet Approval Status report: `GET /reports/timesheet-approval-status` — timesheets with status, hours, approver username, approvedAt. *(DONE session 10)*
- [x] **TSK-RPT-013** Implement Overtime/Deficit report: `GET /reports/overtime-deficit` — weekly grouping of logged vs target (respects `WorkPolicy.DailyExpectedMinutes` per user). *(DONE session 10)*

### E8-F2 Export
- [x] **TSK-RPT-007** Implement CSV export service.
- [ ] **TSK-RPT-008** Implement true Excel export service. *(Currently returns CSV bytes with Excel MIME — corrupt when opened in Excel; needs EPPlus or ClosedXML)*
- [ ] **TSK-RPT-009** Implement true PDF export for summary reports. *(Currently returns CSV bytes with PDF MIME — needs a PDF rendering library)*
- [x] **TSK-RPT-010** Ensure exports respect filters and role-based scope.

---

## Epic E9 — Notifications and Reminders

### E9-F1 Notification Infrastructure
- [ ] **TSK-NTF-001** Create Notification schema and delivery status tracking. *(Phase 1 audit: ARCH-002 — marked DONE but model/table/code did not exist; implemented in Phase 2)*
- [ ] **TSK-NTF-002** Build notification generation service. *(Phase 1 audit: ARCH-002 — not implemented)*
- [ ] **TSK-NTF-003** Implement in-app notification API and UI panel. *(Phase 1 audit: ARCH-002 — not implemented)*

### E9-F2 Scheduled Reminders
- [ ] **TSK-NTF-004** Implement missing checkout reminder job. *(Phase 1 audit: ARCH-002 — not implemented)*
- [ ] **TSK-NTF-005** Implement missing timesheet reminder job. *(Phase 1 audit: ARCH-002 — not implemented)*
- [ ] **TSK-NTF-006** Implement pending approvals reminder job. *(Phase 1 audit: ARCH-002 — not implemented)*
- [ ] **TSK-NTF-007** Implement leave/timesheet status change notifications. *(Phase 1 audit: ARCH-002 — not implemented)*
- [ ] **TSK-NTF-008** Add configurable schedule and templates. *(Phase 1 audit: ARCH-002 — not implemented)*

---

## Epic E10 — Audit and Compliance

### E10-F1 Audit Trail
- [x] **TSK-AUD-001** Create AuditLog schema.
- [ ] **TSK-AUD-002** Add audit hooks for timesheet CRUD. *(Phase 1 audit: ARCH-003 — only UsersController logged; fixed in Phase 2)*
- [ ] **TSK-AUD-003** Add audit hooks for leave and approval actions. *(Phase 1 audit: ARCH-003 — not implemented; fixed in Phase 2)*
- [ ] **TSK-AUD-004** Add audit hooks for admin/policy changes. *(Phase 1 audit: ARCH-003 — not implemented; fixed in Phase 2)*
- [x] **TSK-AUD-005** Build audit query APIs and admin audit UI.

### E10-F2 Compliance Views
- [x] **TSK-AUD-006** Build missing timesheet compliance report.
- [x] **TSK-AUD-007** Build late submission and approval SLA report.
- [x] **TSK-AUD-008** Build attendance exception report.

---

## Epic E11 — Admin Configuration and Master Data

### E11-F1 Policy Configuration
- [x] **TSK-ADM-001** Create WorkPolicy configuration entities.
- [x] **TSK-ADM-002** Build admin UI for lunch deduction/backdate/mismatch rules.
- [x] **TSK-ADM-003** Connect policy values to attendance/timesheet validators.

### E11-F2 Holiday and Calendar
- [ ] **TSK-ADM-004** Create Holiday schema and admin CRUD APIs. *(Phase 1 audit: ARCH-002 — marked DONE but model/table/code did not exist; implemented in Phase 2)*
- [ ] **TSK-ADM-005** Build holiday calendar UI. *(Phase 1 audit: ARCH-002 — not implemented)*
- [ ] **TSK-ADM-006** Integrate holiday logic into expected-hours calculations. *(Phase 1 audit: ARCH-002 — not implemented)*

---

## Epic E12 — Engineering Quality, Delivery, and DevOps

### E12-F1 Architecture and Code Quality
- [x] **TSK-ENG-001** Set up backend solution structure (API/Application/Domain/Infrastructure).
- [x] **TSK-ENG-002** Set up frontend module structure (auth/dashboard/attendance/timesheet/etc.).
- [ ] **TSK-ENG-003** Add API versioning and standardized error response format. *(Phase 1 audit: ARCH-001 — URL prefix exists but no framework; errors are ad-hoc `{ message }` objects; fixed in Phase 2 with ProblemDetails)*
- [ ] **TSK-ENG-004** Add request validation framework. *(Phase 1 audit: VALID-001 — no DataAnnotations on any DTO; fixed in Phase 2)*
- [ ] **TSK-ENG-005** Add structured logging and correlation IDs. *(Phase 1 audit: ERRH-002 — no ILogger, no Serilog, no correlation IDs; fixed in Phase 2)*

### E12-F2 Database and Migration
- [x] **TSK-DB-001** Create normalized SQL Server schema scripts/migrations.
- [ ] **TSK-DB-002** Add seed data for roles, statuses, leave types, task categories. *(Note: code exists in DbInitializer.cs but was tracked as TODO — marking fixed in Phase 2)*
- [ ] **TSK-DB-003** Add database indexing for report-heavy queries. *(Phase 1 audit: DB-001 — missing indexes on Timesheets.UserId, WorkDate, TimesheetEntries.ProjectId, WorkSessions.Status, LeaveRequests.UserId; fixed in Phase 2)*

### E12-F3 Testing
- [x] **TSK-QA-001** Add unit tests for attendance/timesheet/leave business logic.
- [x] **TSK-QA-002** Add API integration tests for critical flows.
- [x] **TSK-QA-003** Add frontend component tests for forms and status flows.
- [x] **TSK-QA-004** Add end-to-end smoke tests for key user journeys.

### E12-F4 Delivery and Operations
- [x] **TSK-OPS-001** Add environment-based config management.
- [x] **TSK-OPS-002** Add CI pipeline for build/test/lint.
- [x] **TSK-OPS-003** Add deployment scripts/templates for backend/frontend/db.
- [x] **TSK-OPS-004** Add health checks and readiness endpoints.
- [x] **TSK-OPS-005** Document runbooks and rollback basics.

---

## Phase 1 Audit Findings

The following issues were discovered during a comprehensive Phase 1 audit of the codebase. All findings are addressed in the Phase 2 Fix Tasks section below.

### Security Findings

| ID | Severity | Description |
|---|---|---|
| **SEC-001** | HIGH | Hardcoded `admin` / `admin123` seed credentials in `DbInitializer.cs` and pre-filled in login form |
| **SEC-002** | MEDIUM | JWT secret key placeholder committed to `appsettings.json` source control |
| **SEC-003** | LOW | No rate limiting on `POST /auth/login` — brute-force attacks possible |
| **SEC-004** | LOW | Revoked refresh tokens never purged from DB — table grows unboundedly |
| **SEC-005** | MEDIUM | Dual role fields (`User.Role` string + `UserRoles` join table) can drift out of sync; JWT falls back to string field |
| **SEC-006** | LOW | `DashboardController.Management()` uses manual role check instead of `[Authorize(Roles = "admin")]` attribute |
| **SEC-007** | MEDIUM | CORS hardcoded to `http://localhost:5173` only — production deployments break |
| **SEC-009** | LOW | Excel/PDF export returns CSV bytes with wrong MIME type — file is corrupt when opened |

### Configuration Findings

| ID | Severity | Description |
|---|---|---|
| **CFG-001** | HIGH | SA database password (`Your_strong_password123`) committed to `appsettings.json` |
| **CFG-002** | HIGH | JWT secret key committed to source control — any token is forgeable by anyone with repo read access |
| **CFG-003** | MEDIUM | No `appsettings.Production.json` or secrets management mechanism for operators |
| **CFG-004** | LOW | `TrustServerCertificate=True` acceptable in dev but must not be used in production |
| **CFG-005** | LOW | Frontend API base URL hardcoded to `http://localhost:5000/api/v1` |

### Architecture / Missing Features

| ID | Severity | Description |
|---|---|---|
| **ARCH-001** | MEDIUM | No standardized error response format — all errors are ad-hoc `{ message }` anonymous objects |
| **ARCH-002** | MEDIUM | Notifications (TSK-NTF-001–008) and Holiday calendar (TSK-ADM-004–006) marked DONE but zero code existed |
| **ARCH-003** | MEDIUM | Audit logging only covers `UsersController`; timesheets, leaves, approvals have no audit trail |
| **ARCH-004** | LOW | Audit actor can be `null` if JWT claim parse fails — entry becomes untraceable |
| **ARCH-005** | MEDIUM | `GET /timesheets/week` makes up to 21 separate DB queries (7 days × 3 queries each) |
| **ARCH-006** | MEDIUM | Leave utilization report makes 75+ DB queries per page (3 queries per user × 25 users) |

### Validation Findings

| ID | Severity | Description |
|---|---|---|
| **VALID-001** | HIGH | No validation framework anywhere — no `DataAnnotations`, no FluentValidation, no `[Required]` on any DTO |

### Error Handling Findings

| ID | Severity | Description |
|---|---|---|
| **ERRH-001** | MEDIUM | No global exception handler — unhandled exceptions expose stack traces in dev |
| **ERRH-002** | LOW | No structured logging, no `ILogger<T>`, no correlation IDs |

### Business Logic Findings

| ID | Severity | Description |
|---|---|---|
| **LOGIC-001** | LOW | Attendance report bypasses `AttendanceCalculationService` — lunch deduction not applied in reports |
| **LOGIC-002** | LOW | Billable task detection uses string substring match (`name.Contains("bill")`) instead of a dedicated `IsBillable` field |

### Frontend Findings

| ID | Severity | Description |
|---|---|---|
| **FE-001** | MEDIUM | Role read from `localStorage` on session restore without re-verifying against server |
| **FE-002** | MEDIUM | `accessToken` + `refreshToken` stored in `localStorage` — vulnerable to XSS theft |
| **FE-003** | MEDIUM | No automatic token refresh on 401 — expired tokens silently fail; UI shows stale/empty data |
| **FE-004** | LOW | `window.prompt()` used for approval/rejection comments — no styling, no validation |
| **FE-006** | HIGH | Entire React application in a single 193-line `App.tsx` — unstructured and untestable |

### Database Findings

| ID | Severity | Description |
|---|---|---|
| **DB-001** | MEDIUM | Missing indexes: `Timesheets(UserId)`, `Timesheets(WorkDate)`, `TimesheetEntries(ProjectId)`, `WorkSessions(UserId)`, `WorkSessions(Status)`, `LeaveRequests(UserId)` |
| **DB-002** | MEDIUM | No migration framework — uses `EnsureCreated()`; schema evolution requires manual intervention |

### Test Findings

| ID | Severity | Description |
|---|---|---|
| **TEST-001** | MEDIUM | InMemory EF Core provider used in tests — does not enforce unique/FK constraints; tests may pass when SQL Server would reject |
| **TEST-002** | LOW | No tests for Reports, Dashboard, Masters, or Export endpoints |

---

## Phase 2 Fix Tasks

All Phase 2 tasks address findings from the Phase 1 audit above.

### P2-Security
- [x] **FIX-SEC-001** Restructure `appsettings.json` to remove hardcoded secrets; add CORS origins config; add startup validation for placeholder JWT key.
- [x] **FIX-SEC-002** Add rate limiting (10 req / 15 min per IP) on `POST /auth/login` using ASP.NET Core 8 built-in rate limiter.
- [x] **FIX-SEC-003** Add `RefreshTokenCleanupService` background job to purge expired/revoked tokens daily.
- [x] **FIX-SEC-004** Remove JWT role fallback to `User.Role` string field — claims sourced exclusively from `UserRoles` join table.
- [x] **FIX-SEC-005** Replace manual role check in `DashboardController.Management()` with `[Authorize(Roles = "admin")]` attribute.
- [x] **FIX-SEC-006** Make CORS origins configurable via `appsettings.json` `Cors:AllowedOrigins` array.

### P2-ErrorHandling
- [x] **FIX-ERR-001** Add global exception handler returning RFC 7807 `ProblemDetails` with `traceId`.
- [x] **FIX-ERR-002** Replace all ad-hoc `{ message }` error returns in all controllers with `Problem(...)` calls.
- [x] **FIX-ERR-003** Add Serilog structured logging with console JSON sink.
- [x] **FIX-ERR-004** Add `CorrelationIdMiddleware` — reads/generates `X-Correlation-ID` header and enriches log context.

### P2-Validation
- [x] **FIX-VAL-001** Add `DataAnnotations` (`[Required]`, `[MaxLength]`, `[EmailAddress]`, `[Range]`, `[MinLength]`) to all 10 DTO files.

### P2-MissingFeatures
- [x] **FIX-FEAT-001** Implement `Notification` model, `NotificationService`, `NotificationsController`, and `NotificationSchedulerService` background job (TSK-NTF-001..008).
- [x] **FIX-FEAT-002** Implement `Holiday` model, `HolidaysController`, seed data, and integrate holidays into expected-hours logic (TSK-ADM-004..006).
- [x] **FIX-FEAT-003** Extract `AuditService` from `UsersController`; add audit calls to `TimesheetsController`, `ApprovalsController`, `LeaveController` (TSK-AUD-002..004).
- [x] **FIX-FEAT-004** Add `IsBillable` field to `TaskCategory` model and use it in `DashboardController.Management()` billable calculation.

### P2-Performance
- [x] **FIX-PERF-001** Fix N+1 in `TimesheetsController.GetWeek()` — batch all 7-day queries into 3 bulk queries.
- [x] **FIX-PERF-002** Fix N+1 in `ReportsController.LeaveAndUtilization()` — replace per-user loop with grouped aggregate query.
- [x] **FIX-PERF-003** Fix attendance report calculation — use `AttendanceCalculationService` instead of inline formula.

### P2-Database
- [x] **FIX-DB-001** Add missing indexes to `db/schema.sql` and `TimeSheetDbContext`: `Timesheets(UserId)`, `Timesheets(WorkDate)`, `TimesheetEntries(ProjectId)`, `WorkSessions(UserId)`, `WorkSessions(Status)`, `LeaveRequests(UserId)`, `Notifications(UserId, IsRead)`, `Holidays(Date)`.
- [x] **FIX-DB-002** Add `Notifications` and `Holidays` tables to `db/schema.sql`.
- [x] **FIX-DB-003** Add `IsBillable BIT` column to `TaskCategories` in `db/schema.sql`.

### P2-Frontend
- [x] **FIX-FE-001** Break monolithic `App.tsx` into components: `Login`, `Dashboard`, `Timesheets`, `Leave`, `Approvals`, `Reports`, `Notifications`, and admin sub-components.
- [x] **FIX-FE-002** Add `api/client.ts` with token refresh interceptor — auto-retry on 401, redirect to login on second failure.
- [x] **FIX-FE-003** Add `useSession` hook — trusts localStorage directly (no `/auth/me` round-trip on refresh; tokens validated naturally by API calls).
- [x] **FIX-FE-004** Replace `window.prompt()` for approval/rejection comments with inline form inputs.
- [x] **FIX-FE-005** Replace hardcoded `API_BASE` with `import.meta.env.VITE_API_BASE`; add `.env.development`.
- [x] **FIX-FE-006** Add notification bell UI with unread badge, dropdown list, and mark-read controls.

### P3-UI Redesign *(session 6–7, 2026-03-16)*
- [x] **FIX-FE-007** Install React Router v7; add URL-based navigation (`BrowserRouter`, `Routes`, `Route`); fix page-refresh redirect-to-login bug. *(session 6)*
- [x] **FIX-FE-008** Redesign Timesheets page to PulseHQ v3.0 — two-column layout, week strip calendar, entry cards with colored left borders, dashed entry form, sidebar timer/summary/by-project. Start/end times stored as `[HH:MM-HH:MM]` prefix in notes field. *(session 6, branch: master)*
- [x] **FIX-FE-009** Add `btn-outline-success` and `btn-outline-reject` button variants to design-system.css; apply to Approvals and Leave approve/reject actions. *(session 7)*
- [x] **FIX-FE-010** Redesign Approvals page to PulseHQ v3.0 — KPI stat cards, tab filter, unified timesheet+leave card list, bulk approve. *(session 7, branch: master)*
- [x] **FIX-FE-011** Redesign Leave page to PulseHQ v3.0 — balance cards, date-range form, grouped history table, mini calendar sidebar, Team on Leave panel, admin Create Leave Type, manager pending approvals. *(session 7, branch: feature/leave-policy-redesign)*
- [x] **FIX-FE-012** Create `Admin/LeavePolicies.tsx` — list/create/edit leave policies with per-type day allocations; routed at `/leave-policies` (admin only). *(session 7, branch: feature/leave-policy-redesign)*
- [x] **FIX-FE-013** Update `Admin/Users.tsx` to support leave policy assignment — dropdown + table column. *(session 7, branch: feature/leave-policy-redesign)*

### P2-Tests
- [x] **FIX-TEST-001** Add `NotificationsIntegrationTests.cs` — create, read, mark-read flows.
- [x] **FIX-TEST-002** Add `HolidaysIntegrationTests.cs` — CRUD and expected-hours integration.
- [x] **FIX-TEST-003** Add `ReportsIntegrationTests.cs` — attendance, timesheet, project-effort, export.
- [x] **FIX-TEST-004** Add `DashboardIntegrationTests.cs` — employee, manager, management views.

---

## Milestone Task Bundles (Recommended)

### Sprint 0 (Discovery & Design)
- TSK-ENG-001, TSK-ENG-002, TSK-DB-001, API contract drafting, wireframes, ERD.

### Sprint 1 (Foundation)
- TSK-AUTH-001..010, TSK-RBAC-001..005, TSK-USER-001..006, TSK-PRJ-001..006, TSK-TASK-001..005.

### Sprint 2 (Attendance)
- TSK-ATT-001..008, TSK-BRK-001..007, TSK-CALC-001..005.

### Sprint 3 (Timesheets)
- TSK-TS-001..017.

### Sprint 4 (Leave + Approvals)
- TSK-LV-001..009, TSK-APR-001..007.

### Sprint 5 (Dashboards + Reports)
- TSK-DSH-EMP-001..005, TSK-DSH-MGR-001..005, TSK-DSH-MGMT-001..004, TSK-RPT-001..010.

### Sprint 6 (Stabilization)
- TSK-NTF-001..008, TSK-AUD-001..008, TSK-ADM-001..006, TSK-QA-001..004, TSK-OPS-001..005.

### Sprint 7 (Phase 2 — Audit Fixes)
- All FIX-* tasks listed under Phase 2 Fix Tasks above.

### Sprint 8 (UI Redesign — Sessions 6–7)
- FIX-FE-007..013 — React Router, Timesheets v3, Approvals v3, Leave v3, LeavePolicies admin.

### Sprint 9 (Leave Policy — Backend + UX Polish) ✅ DONE
- TSK-LV-010 — LeavePolicy + LeavePolicyAllocation schema and admin CRUD APIs. ✅
- TSK-LV-011 — Leave balance tracking APIs (my balance, user balance). ✅
- TSK-LV-012 — Extend `POST /leave/requests` for `fromDate`/`toDate` range. ✅
- TSK-LV-013 — `GET /leave/calendar` API for calendar dots (includes rejected). ✅
- TSK-LV-014 — `GET /leave/team-on-leave` API. ✅
- TSK-LV-015 — `GET /leave/requests/my/grouped` for grouped history. ✅
- TSK-LV-019 — Fix 500 re-apply bug (unique constraint). ✅
- TSK-LV-020 — Cancel leave endpoint. ✅
- TSK-LV-021 — Leave history cards UX (date ranges, actions, validation errors). ✅
- TSK-LV-022 — Leave Types section in LeavePolicies admin. ✅
- Timesheets UX: approved state green border, progress bar overlap fix, day bar green, delete modal, Sunday pct fix, notification bell dot. ✅
- [ ] TSK-APR-009 — `GET /approvals/stats` for KPI cards. *(Backend pending)*

### Sprint 10 (Reports Refactor) ✅ DONE
- TSK-RPT-011 — Leave Balance report endpoint + DTO. ✅
- TSK-RPT-012 — Timesheet Approval Status report endpoint + DTO. ✅
- TSK-RPT-013 — Overtime/Deficit report endpoint + DTO. ✅
- TSK-RPT-006 — Reports page full redesign (16 improvements: tabs, date filter, KPI cards, sortable columns, pagination, search, employee filter, human-readable headers, hidden UUIDs, h:m formatting, status badges, utilization bars, balance bars, delta coloring, freshness indicator, row hover, scroll gradient, rows-per-page, "Showing X–Y of Z"). ✅

### Sprint 11 (Dashboard v2) ✅ DONE
- TSK-DASH-011 — Fix dept bar chart height=0 bug (BarChartDept with inline flexbox). ✅
- TSK-DASH-012 — Fix compliance dates (ISO → human-readable, employee+rule sub-label). ✅
- TSK-DASH-013 — Fix dept label truncation (full name + text-overflow ellipsis). ✅
- TSK-DASH-014 — Replace emoji stat card icons with 20×20px stroke SVG components. ✅
- TSK-DASH-015 — Real trend badges (up/down/flat based on live data). ✅
- TSK-DASH-016 — Utilization UtilBar (60px/4px, red/amber/green) + "Target: 40h/week" header. ✅
- TSK-DASH-017 — Zero-value legend items opacity 0.4. ✅
- TSK-DASH-018 — DonutChart enlarged (130px admin, 110px others), arc tooltips, dominant segment label. ✅
- TSK-DASH-019 — 4th admin stat card → Pending Approvals (amber/green + Review link). ✅
- TSK-DASH-020 — Effort by Project: % of total label + "→ View" link per row. ✅
- TSK-DASH-021 — Semantic headings (page-title → h1, card-title → h2). ✅
- TSK-DASH-022 — Period selector (Today / This Week / Last 30 Days / This Quarter). ✅
- TSK-DASH-023 — Data freshness label + ↻ Refresh button. ✅
- TSK-DASH-024 — Activity items interactive (cursor pointer + navigate on click). ✅
- TSK-DASH-025 — Export split button (PDF / CSV / Copy link dropdown). ✅
- TSK-DASH-026 — Fix bottom grid: 4-column layout (was 3-column). ✅
- TSK-DASH-027 — "Who's on Leave Today" widget (4th column, fetches /leave/team-on-leave). ✅
- TSK-DASH-028 — Sparkline SVG polyline on Billable Ratio stat card. ✅
- TSK-DASH-029 — Timesheet Submission Rate full-width widget with progress bar + CTA. ✅

### Sprint 12 (Dashboard UX Polish + Sidebar Overhaul + Admin Table Sort) ✅ DONE
#### Dashboard UX Polish
- TSK-DASH-030 — Compact page header: period filter moved to sub-row below title/actions. ✅
- TSK-DASH-031 — Relative time freshness: `relativeTime()` inside `<time dateTime>` element. ✅
- TSK-DASH-032 — ARIA progressbar role + aria-valuenow/min/max/label on all progress tracks. ✅
- TSK-DASH-033 — Severity tiers: `.progress-fill--critical/warning/caution/success` on all bars. ✅
- TSK-DASH-034 — Utilization hardcode fix: `UtilBar` uses `status` from backend `UserLoad` (removed `targetMinutes={2400}`). ✅
- TSK-DASH-035 — Billable card label fix: removed redundant KpiItems; renamed to "Billable". ✅
- TSK-DASH-036 — Calendar SVG empty state in "On Leave Today" widget. ✅
- TSK-DASH-037 — Submission Rate CTA button moved from card-header to below progress bar. ✅
- TSK-DASH-038 — "View all projects" nav bug fixed (`"reports"` → `"projects"`). ✅
- TSK-DASH-039 — Focus-visible rings on `button` and `a` elements; KPI row hover + focus. ✅

#### Sidebar Overhaul (AppShell.tsx)
- TSK-SHELL-001 — User profile section: avatar, online dot, name, role between brand and nav. ✅
- TSK-SHELL-002 — CSS-only tooltips via `data-tooltip` + `::after/::before` in collapsed state. ✅
- TSK-SHELL-003 — Sign Out styled with `.nav-item--danger`. ✅
- TSK-SHELL-004 — Live Approvals `.nav-badge` wired to `/approvals/pending-timesheets` count. ✅
- TSK-SHELL-005 — Collapse button `aria-label` + `.sidebar-collapse-btn` CSS affordance. ✅
- TSK-SHELL-006 — `aria-hidden="true"` on all SVG nav icons. ✅
- TSK-SHELL-007 — "Workspace" label on first unlabelled nav section. ✅
- TSK-SHELL-008 — `.nav-section` gap 1px → 4px. ✅
- TSK-SHELL-009 — Active item left-border via `box-shadow: inset 3px 0 0 var(--brand-500)`. ✅
- TSK-SHELL-010 — Nav icon color-based differentiation (no more opacity hack). ✅
- TSK-SHELL-011 — Distinct icons: `LeavePolicyIcon` and `BriefcaseIcon` for admin nav. ✅
- TSK-SHELL-012 — Sidebar border → `box-shadow: inset -1px 0 0` (sub-pixel crisp). ✅
- TSK-SHELL-013 — Removed org-switcher block; sidebar collapse toggle bug fixed. ✅
- TSK-SHELL-014 — Numeric unread badge on notification bell (Notifications.tsx). ✅

#### Admin Tables — Sort on All Master Pages
- TSK-ADM-010 — `Admin/Projects.tsx`: overflow menu fixed positioning (escapes clip) + sortable columns. ✅
- TSK-ADM-011 — `Admin/Categories.tsx`: sortable by name, isBillable, isActive. ✅
- TSK-ADM-012 — `Admin/Holidays.tsx`: sortable by name, date (default), isRecurring. ✅
- TSK-ADM-013 — `Admin/WorkPolicies.tsx`: sortable by name, dailyExpectedMinutes, isActive. ✅
- TSK-ADM-014 — `Admin/LeavePolicies.tsx`: sortable by name, isActive. ✅
- TSK-ADM-015 — `Admin/Users.tsx`: sortable by username, role, departmentName, isActive; empty-row guard fixed. ✅

---

## Phase 3 — Product Roadmap (Principal Designer Review, 2026-03-17)

> **Rules for all Phase 3 sprints:**
> - Each sprint lives on its own branch: `feature/sprint-XX-short-name`
> - Backend data model + APIs must be built and tested BEFORE any UI work starts
> - Merge to `master` only after manual testing sign-off
> - One sprint at a time — do not start the next until current is approved

---

### Sprint 13 — User Profile & Self-Service 🔴 NEXT
**Branch:** `feature/sprint-13-user-profile`
**Goal:** Users can manage their own account without admin intervention.

#### Backend
- [ ] **TSK-PRF-001** `GET /users/me` — return full profile (username, email, employeeId, role, dept, workPolicy, leavePolicy, managerId, notificationPrefs).
- [ ] **TSK-PRF-002** `PUT /users/me` — update own display name and email (no role/dept change — admin only).
- [ ] **TSK-PRF-003** `PUT /users/me/password` — change password with `currentPassword` + `newPassword`; verify current before updating hash.
- [ ] **TSK-PRF-004** New `UserNotificationPreferences` table: `{ userId, onApproval, onRejection, onLeaveStatus, onReminder, emailEnabled, inAppEnabled }`.
- [ ] **TSK-PRF-005** `GET /users/me/notification-preferences` + `PUT /users/me/notification-preferences`.
- [ ] **TSK-PRF-006** Integrate preferences into `NotificationSchedulerService` — skip notifications for types the user has disabled.

#### Frontend
- [ ] **TSK-PRF-007** `/profile` route + `Profile.tsx` page (admin + all roles).
- [ ] **TSK-PRF-008** Profile card: read-only fields (role, dept, employee ID, policy) + editable name/email with inline save.
- [ ] **TSK-PRF-009** Password change section: current password + new password with strength meter + confirm.
- [ ] **TSK-PRF-010** Notification preferences: toggle grid (approval, rejection, leave status, reminders) × (in-app, email).
- [ ] **TSK-PRF-011** Add "My Profile" link in topbar user avatar dropdown.

---

### Sprint 14 — Bulk Timesheet Submission 🔴
**Branch:** `feature/sprint-14-bulk-submit`
**Goal:** Submit an entire week's worth of draft timesheets in one action.

#### Backend
- [ ] **TSK-BULK-001** `POST /timesheets/submit-week` — accepts `{ weekStart: "YYYY-MM-DD" }`; finds all `Draft` timesheets for that Mon–Sun range for the calling user; runs the same validation as single-submit for each day; commits all or returns per-day errors.
- [ ] **TSK-BULK-002** Response DTO: `{ submitted: ["2026-03-16", ...], skipped: [{ date, reason }], errors: [{ date, message }] }`.
- [ ] **TSK-BULK-003** Extend existing `POST /timesheets/{id}/submit` tests to cover the new bulk path.

#### Frontend
- [ ] **TSK-BULK-004** "Submit This Week" primary button on weekly timesheet header.
- [ ] **TSK-BULK-005** Pre-submit preview modal: table of each day's status (Draft / Already Submitted / No Entries), with warnings for missing days.
- [ ] **TSK-BULK-006** Result summary: toast showing "X days submitted, Y skipped" with per-day error details if any failed.

---

### Sprint 15 — Manager Team Status Board 🔴
**Branch:** `feature/sprint-15-team-status`
**Goal:** Managers see every direct report's daily status in one glance with inline actions.

#### Backend
- [ ] **TSK-TEAM-001** `GET /manager/team-status?date=YYYY-MM-DD` — for each direct report return:
  - `attendance`: checkedIn | checkedOut | onLeave | absent
  - `checkInTime`, `checkOutTime` (if available)
  - `weekLoggedMinutes`, `weekExpectedMinutes`
  - `todayTimesheetStatus`: draft | submitted | approved | missing
  - `pendingApprovalCount`: number of timesheets awaiting this manager's approval from this user
- [ ] **TSK-TEAM-002** `POST /manager/remind/{userId}` — sends a `Notification` of type `MissingTimesheetReminder` to the specified user.

#### Frontend
- [ ] **TSK-TEAM-003** `TeamStatus.tsx` page, accessible at `"team"` view (manager + admin only).
- [ ] **TSK-TEAM-004** Status table: Avatar · Name · Today Status · Week Progress bar · Timesheet · Actions.
- [ ] **TSK-TEAM-005** Filter bar: All / Missing Today / Needs Approval / On Leave.
- [ ] **TSK-TEAM-006** Inline actions: [Remind] for missing timesheet, [Approve] jumps to Approvals filtered to that user.
- [ ] **TSK-TEAM-007** Add "Team" nav item to AppShell for manager/admin.

---

### Sprint 16 — Task-Level Timer ⏱
**Branch:** `feature/sprint-16-task-timer`
**Goal:** Capture time as it happens — timer auto-creates timesheet entries on stop.

#### Backend
- [ ] **TSK-TMR-001** New `TimerSessions` table: `{ id, userId, projectId, categoryId, note, startedAtUtc, stoppedAtUtc, durationMinutes, convertedToEntryId }`.
- [ ] **TSK-TMR-002** `GET /timers/active` — returns the currently running timer for the calling user, or 404.
- [ ] **TSK-TMR-003** `POST /timers/start` — `{ projectId, categoryId, note? }`; enforces one active timer per user.
- [ ] **TSK-TMR-004** `POST /timers/stop` — stops active timer, calculates `durationMinutes`, returns the record. Does NOT auto-create entry (user confirms).
- [ ] **TSK-TMR-005** `POST /timers/{id}/convert` — creates a draft timesheet entry from the timer record; sets `convertedToEntryId`.
- [ ] **TSK-TMR-006** `GET /timers/history?date=YYYY-MM-DD` — recent timer sessions for the day.

#### Frontend
- [ ] **TSK-TMR-007** Persistent timer widget in Timesheets sidebar (replaces/extends current Active Timer section).
- [ ] **TSK-TMR-008** Project + Category selector dropdowns on timer start.
- [ ] **TSK-TMR-009** Live HH:MM:SS counter when timer running (polling `/timers/active` every 30s to survive page refresh).
- [ ] **TSK-TMR-010** Stop → "Add to Timesheet?" confirmation with pre-filled entry form showing computed duration.
- [ ] **TSK-TMR-011** Timer persists across page navigation (stored in localStorage with startedAt; reconciled with server on load).

---

### Sprint 17 — Project Budget Burn 📊
**Branch:** `feature/sprint-17-project-budget`
**Goal:** Expose `budgetedHours` data as actionable project health indicators.

#### Backend
- [ ] **TSK-BDG-001** `GET /projects/{id}/budget-summary` — returns `{ budgetedHours, loggedHours, remainingHours, burnRateHoursPerWeek, projectedWeeksRemaining, weeklyBreakdown: [{ weekStart, hours }] }` (last 8 weeks).
- [ ] **TSK-BDG-002** `GET /projects/budget-health` — admin/manager list: all active projects with `{ id, name, budgetedHours, loggedHours, pctUsed, status: "on-track"|"warning"|"critical"|"over-budget" }`. Thresholds: warning ≥80%, critical ≥95%.
- [ ] **TSK-BDG-003** `BudgetedHours` validation in `UpsertProjectRequest` — must be ≥ 0.

#### Frontend
- [ ] **TSK-BDG-004** Budget burn panel in `Admin/Projects.tsx` edit drawer: burn bar, pct used, projected completion date.
- [ ] **TSK-BDG-005** Budget column in Projects table: mini burn bar + pct label; color-coded by status.
- [ ] **TSK-BDG-006** Admin dashboard: "Budget Health" card showing count of warning/critical projects with drill-down list.

---

### Sprint 18 — Recurring Entry Templates 📋
**Branch:** `feature/sprint-18-entry-templates`
**Goal:** One-click pre-fill for users who log the same entries daily.

#### Backend
- [ ] **TSK-TPL-001** New `TimesheetTemplates` table: `{ id, userId, name, createdAt, entries: JSON[] (projectId, categoryId, durationMinutes, note) }`.
- [ ] **TSK-TPL-002** `GET /timesheets/templates` — user's saved templates.
- [ ] **TSK-TPL-003** `POST /timesheets/templates` — save a named template.
- [ ] **TSK-TPL-004** `PUT /timesheets/templates/{id}` — rename or update entries.
- [ ] **TSK-TPL-005** `DELETE /timesheets/templates/{id}`.
- [ ] **TSK-TPL-006** `POST /timesheets/templates/{id}/apply` — `{ date: "YYYY-MM-DD" }`; creates draft entries for that date from the template; skips if entries already exist; returns created entry IDs.

#### Frontend
- [ ] **TSK-TPL-007** "Use Template" button on Timesheets daily view — opens template picker modal.
- [ ] **TSK-TPL-008** "Save as Template" option in entry form context menu or week-view actions.
- [ ] **TSK-TPL-009** Template management section in `Profile.tsx` — list, rename, delete saved templates.

---

### Sprint 19 — Leave Team Calendar 🗓
**Branch:** `feature/sprint-19-leave-team-calendar`
**Goal:** Show who else is off when employees apply for leave; prevent understaffed days.

#### Backend
- [ ] **TSK-LTC-001** `GET /leave/team-calendar?year=&month=` — returns approved + pending leaves for all members of the calling user's department (employee) or direct reports (manager). DTO: `{ date, entries: [{ userId, username, leaveTypeName, status }] }`.
- [ ] **TSK-LTC-002** `GET /leave/conflicts?fromDate=&toDate=&userId=` — returns count of team members on leave during the requested dates; used for conflict warning on apply form.

#### Frontend
- [ ] **TSK-LTC-003** Enhance Leave page mini calendar: overlay team leave chips (small colored dots per user) on each date alongside personal leave dots.
- [ ] **TSK-LTC-004** Conflict warning banner on leave apply form: "3 team members are already off during these dates: [names]."
- [ ] **TSK-LTC-005** Tooltip on calendar date: hover shows list of who is off that day.

---

### Sprint 20 — Anomaly Detection & Alerts 🔔
**Branch:** `feature/sprint-20-anomaly-alerts`
**Goal:** Surface unusual patterns automatically so admins don't need to hunt in reports.

#### Backend
- [ ] **TSK-ANM-001** New `AnomalyRules` enum: `ExcessiveDailyHours` (>12h), `ExtendedMissingTimesheet` (>5 consecutive working days), `ProjectBudgetWarning` (≥80%), `ProjectBudgetCritical` (≥95%), `ComplianceDropped` (team compliance down ≥15% vs prior month).
- [ ] **TSK-ANM-002** `AnomalyDetectionService` — background service, runs daily at 07:00 UTC; evaluates all rules; creates `Notification` records with `Type = Anomaly`, deduplicates (don't re-alert same anomaly within 7 days).
- [ ] **TSK-ANM-003** `GET /admin/anomalies` — active unresolved anomaly notifications; supports `?severity=warning|critical` filter.
- [ ] **TSK-ANM-004** `POST /admin/anomalies/{id}/dismiss` — marks anomaly notification as dismissed.

#### Frontend
- [ ] **TSK-ANM-005** "Anomaly Alerts" panel on admin dashboard — shows active alerts grouped by severity (critical first). Each: icon, description, affected entity, [Dismiss] button, [Investigate →] link to relevant page.
- [ ] **TSK-ANM-006** Anomaly notifications appear in the notification bell with a distinct icon.

---

### Sprint 21 — Saved & Scheduled Reports 📧
**Branch:** `feature/sprint-21-saved-reports`
**Goal:** Reports are persistent and can be auto-delivered without manual action.

#### Backend
- [ ] **TSK-SVR-001** New `SavedReports` table: `{ id, userId, name, reportKey, filtersJson, scheduleType (none|weekly|monthly), scheduleDayOfWeek, scheduleHour, recipientEmailsJson, lastRunAt, createdAt }`.
- [ ] **TSK-SVR-002** `GET /reports/saved` — user's saved reports list.
- [ ] **TSK-SVR-003** `POST /reports/saved` — save current filter set as named report.
- [ ] **TSK-SVR-004** `PUT /reports/saved/{id}` — update name/schedule/recipients.
- [ ] **TSK-SVR-005** `DELETE /reports/saved/{id}`.
- [ ] **TSK-SVR-006** `GET /reports/saved/{id}/run` — execute saved report with stored filters; returns same DTO as live report.
- [ ] **TSK-SVR-007** `ReportSchedulerService` — background service checks saved reports due for delivery; generates CSV; sends via `SmtpClient` or stub email service; updates `lastRunAt`.

#### Frontend
- [ ] **TSK-SVR-008** "Save Current Filters" button on Reports page → modal: name input + optional schedule (frequency, day/time, recipients).
- [ ] **TSK-SVR-009** Saved reports list in Reports page left panel / dropdown — click to reload filters.
- [ ] **TSK-SVR-010** "Manage Saved Reports" sub-page: list with last run time, edit schedule, delete.

---

### Sprint 22 — Approval Delegation 🤝
**Branch:** `feature/sprint-22-approval-delegation`
**Goal:** Managers can delegate approvals during absence; no backlogs during leave.

#### Backend
- [ ] **TSK-DEL-001** New `ApprovalDelegations` table: `{ id, fromUserId, toUserId, fromDate, toDate, isActive, createdAt }`. Constraint: one active delegation per `fromUserId` at a time.
- [ ] **TSK-DEL-002** `GET /approvals/delegation` — current active delegation for the calling user.
- [ ] **TSK-DEL-003** `POST /approvals/delegation` — create delegation; validates `toUserId` is a manager or admin; validates no date overlap with existing active delegation.
- [ ] **TSK-DEL-004** `DELETE /approvals/delegation/{id}` — revoke delegation.
- [ ] **TSK-DEL-005** Modify `GET /approvals/pending-timesheets` — if the calling user is a delegate, also return items where `fromUser` is the delegating manager (and delegation is currently active).
- [ ] **TSK-DEL-006** Modify approval/reject APIs — accept actions from delegate; record `ActedByUserId` and `DelegatedFromUserId` in `ApprovalActions`.

#### Frontend
- [ ] **TSK-DEL-007** "Delegate Approvals" section in `Profile.tsx` or Approvals page — select user, date range, save.
- [ ] **TSK-DEL-008** Active delegation banner on Approvals page: "You are approving on behalf of [name] until [date]. [Revoke]"
- [ ] **TSK-DEL-009** Delegated items visually tagged in approval list: "via [delegating manager]".

---

### Sprint 23 — Command Palette ⌨️
**Branch:** `feature/sprint-23-command-palette`
**Goal:** Keyboard-first power navigation — Cmd+K launches a global action/search overlay.

#### Backend
- No new endpoints. All data comes from existing APIs already loaded in the app.

#### Frontend
- [ ] **TSK-CMD-001** `CommandPalette.tsx` — modal overlay triggered by `Cmd+K` / `Ctrl+K`.
- [ ] **TSK-CMD-002** Static command list: navigate to all views, open create forms (New Entry, Apply Leave, New User, New Project).
- [ ] **TSK-CMD-003** Dynamic search: fuzzy match against loaded users (admin), projects, recent timesheets.
- [ ] **TSK-CMD-004** Keyboard navigation: ↑/↓ to move, `Enter` to execute, `Esc` to close, type to filter.
- [ ] **TSK-CMD-005** Keyboard shortcut hints panel: `?` key opens a modal listing all available shortcuts.
- [ ] **TSK-CMD-006** Global shortcuts: `N` = new timesheet entry (if on Timesheets), `S` = submit week, `A` = approve selected (if on Approvals), `/` = focus search.
- [ ] **TSK-CMD-007** Mount palette globally in `AppShell.tsx`; pass navigation handler down.

---

### Sprint 24 — Mobile PWA 📱
**Branch:** `feature/sprint-24-mobile-pwa`
**Goal:** Core workflows (check in/out, quick timesheet entry) usable on a phone.

#### Backend
- No changes — the existing API is already mobile-compatible.

#### Frontend
- [ ] **TSK-MOB-001** `manifest.json` + `vite-plugin-pwa` — add PWA manifest (name, icons, theme color, display: standalone).
- [ ] **TSK-MOB-002** Service worker: cache app shell + static assets for offline load; network-first for API calls.
- [ ] **TSK-MOB-003** Responsive sidebar: `@media (max-width: 768px)` — sidebar hidden by default, hamburger button in topbar toggles it as a slide-over drawer.
- [ ] **TSK-MOB-004** Mobile-optimized `AttendanceWidget` — large check-in/out tap targets (min 48px), simplified layout.
- [ ] **TSK-MOB-005** Mobile timesheet entry form — full-width fields, native date/time pickers, bottom sheet pattern instead of inline form.
- [ ] **TSK-MOB-006** Touch-friendly table rows — tap row to open detail/edit instead of requiring small button targets.

---

### Sprint 25 — Dark Mode 🌙
**Branch:** `feature/sprint-25-dark-mode`
**Goal:** Full dark theme using existing CSS variable architecture.

#### Backend
- No changes.

#### Frontend
- [ ] **TSK-DRK-001** `[data-theme="dark"]` override block in `design-system.css` — map all `--n-*`, `--brand-*`, `--text-*`, `--border-*` tokens to dark equivalents.
- [ ] **TSK-DRK-002** `useTheme` hook — stores preference in `localStorage`; applies `data-theme` on `<html>`.
- [ ] **TSK-DRK-003** Respects `prefers-color-scheme` media query on first load if no preference saved.
- [ ] **TSK-DRK-004** Theme toggle in `Profile.tsx` notification preferences + topbar icon shortcut.
- [ ] **TSK-DRK-005** Audit all inline `style={{ background: ... }}` hardcoded values in components — replace with CSS variable equivalents so dark mode applies correctly.

---

## Phase 3 Branch Naming Convention

```
feature/sprint-13-user-profile
feature/sprint-14-bulk-submit
feature/sprint-15-team-status
feature/sprint-16-task-timer
feature/sprint-17-project-budget
feature/sprint-18-entry-templates
feature/sprint-19-leave-team-calendar
feature/sprint-20-anomaly-alerts
feature/sprint-21-saved-reports
feature/sprint-22-approval-delegation
feature/sprint-23-command-palette
feature/sprint-24-mobile-pwa
feature/sprint-25-dark-mode
```

## Phase 3 Delivery Order (Recommended)

| Priority | Sprint | Why first |
|----------|--------|-----------|
| 1 | 13 — User Profile | Foundational — needed before notification prefs in later sprints |
| 2 | 14 — Bulk Submit | Highest daily-friction fix; pure backend extension, low risk |
| 3 | 15 — Team Status | Highest manager value; new endpoint, no schema change |
| 4 | 16 — Task Timer | New table + persistent widget; biggest engagement driver |
| 5 | 17 — Budget Burn | Uses existing `budgetedHours` field; low backend effort |
| 6 | 18 — Templates | Comfort feature; reduces daily friction |
| 7 | 19 — Leave Team Cal | Extend existing leave endpoints |
| 8 | 20 — Anomaly Alerts | Background service; builds on existing notification infra |
| 9 | 21 — Saved Reports | Persistence layer for reports; needs email service |
| 10 | 22 — Approval Delegation | Schema change + routing logic; test thoroughly |
| 11 | 23 — Command Palette | Pure frontend; do after all pages are stable |
| 12 | 24 — Mobile PWA | Layout overhaul; needs all features settled first |
| 13 | 25 — Dark Mode | Last; needs all inline styles cleaned up first |

---

## Initial Issue Creation Template (Optional)
Use this for each task when opening tracker issues.

```md
Title: [TASK-ID] Short task title

Description:
- Epic/Feature:
- Business value:
- Scope:
- Out of scope:

Acceptance Criteria:
- [ ] Criterion 1
- [ ] Criterion 2

Dependencies:

Test Notes:

Role/Permission Impact:

Audit/Logging Impact:
```
