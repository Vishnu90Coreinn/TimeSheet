# Timesheet Management System — Project Task Plan

This file translates the provided BRD/FRS into implementation-ready tasks for the repository.

## How to use this plan
- Track work by Epic → Feature → Task.
- Keep task IDs stable for issue tracking.
- Mark status with: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`.
- Recommended branch naming: `feature/<featureNameOrID>` for feature work and `bugfix/<bugNameOrID>` for bug work.
- Before merge, complete code review and run lint, tests, and build to ensure no breaking changes.

---

## 🔴 CURRENT PRIORITY — Epic E-CA: Clean Architecture Migration

> **Status:** `TODO` — starts next session (Session 19)
> **Branch:** `feature/clean-architecture`
> **Goal:** Migrate the .NET backend from CRUD-first anemic monolith to Layered Clean Architecture.
> **Constraint:** Zero breaking changes to API routes or frontend at any phase. All 52 tests must pass after each phase.

### Architecture Target

```
TimeSheet.Domain        ← Entities + behavior, Value Objects, Domain Events, Interfaces
TimeSheet.Application   ← MediatR CQRS, FluentValidation, Result<T>, Use Cases
TimeSheet.Infrastructure← EF Core, Repositories, UnitOfWork, Background Jobs, Services
TimeSheet.Api           ← Thin controllers, Middleware, Program.cs (composition root)
TimeSheet.Domain.Tests        ← Unit tests: entity behavior
TimeSheet.Application.Tests   ← Unit tests: handlers (mocked repos)
TimeSheet.Integration.Tests   ← Existing 52 tests moved here
```

---

### Phase 1 — Solution Scaffold

- [x] **CA-001** Create `TimeSheet.Domain` class library project (net10.0, zero NuGet deps)
- [x] **CA-002** Create `TimeSheet.Application` class library (depends on Domain; add MediatR, FluentValidation, Mapster)
- [x] **CA-003** Create `TimeSheet.Infrastructure` class library (depends on Application + Domain; EF Core, SQL Server move here)
- [x] **CA-004** Update `TimeSheet.Api` project references: remove direct EF Core, add Application + Infrastructure
- [x] **CA-005** Update `TimeSheet.sln` to include all 4 src projects + rename test project to `TimeSheet.Integration.Tests`
- [x] **CA-006** Create `src/TimeSheet.Domain.Tests` and `src/TimeSheet.Application.Tests` xUnit projects
- [x] **CA-007** Add `Entity.cs` base class (Id, `List<IDomainEvent>`, `AddDomainEvent`, `ClearDomainEvents`)
- [x] **CA-008** Add `Result<T>` / `Result` (Success, NotFound, Forbidden, Validation, Conflict) + `.ToActionResult()` extension
- [x] **CA-009** Add `IUnitOfWork` interface in Domain (`SaveChangesAsync`)
- [x] **CA-010** Add `ICurrentUserService` interface in Application (`UserId`, `Username`, `Role`, `IsAdmin`, `IsManagerOf`)
- [x] **CA-011** Add `IDateTimeProvider` interface in Application (`UtcNow`)
- [x] **CA-012** Add MediatR pipeline behaviors: `ValidationBehavior`, `LoggingBehavior`, `PerformanceBehavior`
- [x] **CA-013** Add `DependencyInjection.cs` in Application (`services.AddApplication()`)
- [x] **CA-014** Add `DependencyInjection.cs` in Infrastructure (`services.AddInfrastructure(config)`)
- [x] **CA-015** Wire `AddApplication()` + `AddInfrastructure()` in `Program.cs` — verify app still starts + 52 tests pass

### Phase 2 — Domain Enrichment ✓ DONE (Session 20)

- [x] **CA-020** Move all 25 entity models from `Api/Models/` → `TimeSheet.Domain/Entities/` (keep EF attributes temporarily)
- [x] **CA-021** Move all enums (`TimesheetStatus`, `LeaveStatus`, `WorkSessionStatus`, `NotificationType`) → `TimeSheet.Domain/Enums/` — also added `Cancelled=3` to `LeaveRequestStatus`
- [x] **CA-022** Add behavior to `Timesheet` entity: `Submit()`, `Approve(approverId)`, `Reject(approverId, comment)`, `PushBack(approverId, comment)`
- [x] **CA-023** Add behavior to `LeaveRequest` entity: `Approve(approverId)`, `Reject(approverId, comment)`, `Cancel()`
- [x] **CA-024** Add behavior to `WorkSession` entity: `CheckOut(checkoutTime)`, `AddBreak(start)`, `EndBreak(end)`
- [x] **CA-025** Create Value Objects: `DateRange`, `Duration`, `WorkHours`
- [x] **CA-026** Domain Exceptions already created in Phase 1: `DomainException`, `InvalidStateTransitionException`, `InsufficientLeaveBalanceException`
- [x] **CA-027** Create Domain Events: `TimesheetSubmittedEvent`, `TimesheetApprovedEvent`, `TimesheetRejectedEvent`, `TimesheetPushedBackEvent`, `LeaveRequestApprovedEvent`, `LeaveRequestRejectedEvent`, `WorkSessionCheckedOutEvent`
- [x] **CA-028** Define repository interfaces in Domain: `ITimesheetRepository`, `IUserRepository`, `ILeaveRepository`, `IProjectRepository`, `INotificationRepository`
- [x] **CA-029** Write unit tests for all entity behavior methods (Domain.Tests) — 22 tests passing
- [x] **CA-030** Verify 52 integration tests still pass ✓

### Phase 3 — Infrastructure Layer ✓ DONE (Session 21)

- [x] **CA-031** Move `TimeSheetDbContext.cs` → `TimeSheet.Infrastructure/Persistence/`
- [x] **CA-032** Move `Migrations/` → `TimeSheet.Infrastructure/Persistence/Migrations/`
- [x] **CA-033** Split EF Fluent config into 25 `IEntityTypeConfiguration<T>` files; OnModelCreating uses ApplyConfigurationsFromAssembly
- [x] **CA-034** `BaseRepository<T>` + `TimesheetRepository`, `UserRepository`, `LeaveRepository`, `ProjectRepository`, `NotificationRepository`
- [x] **CA-035** `UnitOfWork`: SaveChangesAsync → collect domain events → save → dispatch via `(dynamic)` MediatR publish (Domain free of MediatR)
- [x] **CA-036** `TokenService`, `PasswordHasher` + interfaces → `Infrastructure/Services/`
- [x] **CA-037** `AttendanceCalculationService`, `AuditService`, `NotificationService` → `Infrastructure/Services/`
- [x] **CA-038** `CurrentUserService` reads JWT claims via `IHttpContextAccessor`
- [x] **CA-039** `DateTimeProvider` already done in Phase 1
- [x] **CA-040** `RefreshTokenCleanupService`, `NotificationSchedulerService`, `AnomalyDetectionService` → `Infrastructure/BackgroundJobs/`
- [x] **CA-041** All services registered in `AddInfrastructure()`; `Program.cs` only has AddApplication + AddInfrastructure + JWT/CORS/RateLimit
- [x] **CA-042** 52/52 integration tests passing ✓

### Phase 4 — Application Layer (CQRS, feature by feature) ✓ DONE (Sessions 22–25)

#### Auth
- [x] **CA-050** `LoginCommand` + Handler (calls `IUserRepository`, `ITokenService`, `IPasswordHasher`)
- [x] **CA-051** `RefreshTokenCommand` + Handler
- [x] **CA-052** `LogoutCommand` + Handler
- [x] **CA-053** Slim `AuthController` to mediator.Send() calls only

#### Timesheets
- [x] **CA-054** `GetDayTimesheetQuery` + Handler
- [x] **CA-055** `GetWeekSummaryQuery` + Handler
- [x] **CA-056** `AddTimesheetEntryCommand` + Validator + Handler
- [x] **CA-057** `UpdateTimesheetEntryCommand` + Validator + Handler
- [x] **CA-058** `DeleteTimesheetEntryCommand` + Handler
- [x] **CA-059** `SubmitTimesheetCommand` + Handler (calls `timesheet.Submit()`)
- [x] **CA-060** `SubmitWeekCommand` + Handler
- [x] **CA-061** Slim `TimesheetsController` to mediator.Send() calls only

#### Approvals
- [x] **CA-062** `GetPendingApprovalsQuery` + Handler
- [x] **CA-063** `ApproveTimesheetCommand` + Handler (calls `timesheet.Approve()`)
- [x] **CA-064** `RejectTimesheetCommand` + Handler (calls `timesheet.Reject()`)
- [x] **CA-065** Slim `ApprovalsController`

#### Leave
- [x] **CA-066** `ApplyLeaveCommand` + Validator + Handler (balance check → `leaveRequest.Create()`)
- [x] **CA-067** `ApproveLeaveCommand` + Handler (calls `leaveRequest.Approve()`)
- [x] **CA-068** `RejectLeaveCommand` + Handler
- [x] **CA-069** `GetLeaveBalanceQuery`, `GetLeaveRequestsQuery`
- [x] **CA-070** Slim `LeaveController` (calendar/conflict endpoints deferred — complex EF queries)

#### Reports / Dashboard / Admin
- [ ] **CA-071** Reports queries (projections direct to DTOs — bypass repository for perf)
- [ ] **CA-072** Dashboard queries per role
- [x] **CA-073** Reference data CQRS — Roles, TaskCategories, Holidays, Departments, WorkPolicies (Session 26)
- [ ] **CA-074** Profile commands (UpdateProfile, ChangePassword, UpdateAvatar)
- [x] **CA-075** Slim RolesController, TaskCategoriesController, HolidaysController, MastersController (Session 26)

#### Application Tests
- [ ] **CA-076** Unit tests for all Command handlers (mocked IRepository + IUnitOfWork)
- [ ] **CA-077** Unit tests for all Query handlers
- [x] **CA-078** 74/74 tests pass (52 integration + 22 domain) ✓

### Phase 5 — Domain Events ✓ DONE (Session 25)

- [x] **CA-080** `TimesheetApprovedEventHandler` → creates Notification
- [x] **CA-081** `TimesheetRejectedEventHandler` → creates Notification
- [x] **CA-082** `LeaveApprovedEventHandler` → creates Notification + adjusts LeaveBalance
- [x] **CA-083** `LeaveRejectedEventHandler` → creates Notification
- [x] **CA-084** `TimesheetSubmittedEventHandler` → creates pending-approval Notification for manager
- [x] **CA-085** UnitOfWork dispatches domain events via `publisher.Publish((dynamic)domainEvent, ct)`
- [x] **CA-086** 52/52 integration tests passing ✓

### Phase 6 — Cleanup & Tests ✓ DONE (Session 25)

- [x] **CA-090** `Api/Models/`, `Api/Services/`, `Api/Data/` folders removed (entities/services moved to Domain/Infrastructure)
- [x] **CA-091** Architecture cleanup — interfaces consolidated, orphaned services removed
- [x] **CA-092** Global exception handler already in place (RFC 7807 ProblemDetails)
- [x] **CA-093** N/A — deferred (unbounded list queries acceptable for reference data scale)
- [x] **CA-094** EF Core retry policy registered in Infrastructure DI
- [ ] **CA-095** Final architecture review — LeaveController calendar endpoints + TimesheetsController.DeleteEntry still use EF directly (acceptable deferred work)
- [ ] **CA-096** Update README with new solution structure diagram

### Phase 7 — Reference Data CQRS ✓ DONE (Session 26)

- [x] **CA-097** `IRoleRepository`, `ITaskCategoryRepository`, `IHolidayRepository`, `IDepartmentRepository`, `IWorkPolicyRepository` in Domain
- [x] **CA-098** `RoleRepository`, `TaskCategoryRepository`, `HolidayRepository`, `DepartmentRepository`, `WorkPolicyRepository` in Infrastructure (NotificationRepository pattern)
- [x] **CA-099** `Application/ReferenceData/Queries/` — GetRoles, GetTaskCategories, GetHolidays, GetDepartments, GetWorkPolicies
- [x] **CA-100** `Application/ReferenceData/Commands/` — CreateRole; Create/Update/DeleteTaskCategory; Create/Update/DeleteHoliday; CreateDepartment; Create/Update/DeleteWorkPolicy
- [x] **CA-101** DI: 5 new repository registrations in `AddInfrastructure()`
- [x] **CA-102** Slim RolesController, TaskCategoriesController, HolidaysController, MastersController to ISender only
- [x] **CA-103** 74/74 tests pass (52 integration + 22 domain) ✓

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
- [x] **TSK-APR-009** Implement `GET /approvals/stats` — return `approvedThisMonth`, `rejectedThisMonth`, `avgResponseHours` for KPI cards. *(Frontend ready, backend pending — folded into Sprint 13)*

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
- [ ] **TSK-RPT-008** Implement true Excel export service. *(Currently returns CSV bytes with Excel MIME — corrupt when opened in Excel; needs EPPlus or ClosedXML — folded into Sprint 21)*
- [ ] **TSK-RPT-009** Implement true PDF export for summary reports. *(Currently returns CSV bytes with PDF MIME — needs a PDF rendering library — folded into Sprint 21)*
- [x] **TSK-RPT-010** Ensure exports respect filters and role-based scope.

---

## Epic E9 — Notifications and Reminders

### E9-F1 Notification Infrastructure
- [x] **TSK-NTF-001** Create Notification schema and delivery status tracking. ✅ DONE (Session 1 — `Notification.cs`, `NotificationService.cs`, `NotificationsController.cs`)
- [x] **TSK-NTF-002** Build notification generation service. ✅ DONE (Session 1 — `INotificationService`/`NotificationService`)
- [x] **TSK-NTF-003** Implement in-app notification API and UI panel. ✅ DONE (Session 1 backend + Session 2 `Notifications.tsx` frontend)

### E9-F2 Scheduled Reminders
- [x] **TSK-NTF-004** Implement missing checkout reminder job. ✅ DONE (Session 1 — `NotificationSchedulerService` daily 06:00 UTC)
- [x] **TSK-NTF-005** Implement missing timesheet reminder job. ✅ DONE (Session 1 — `NotificationSchedulerService`)
- [x] **TSK-NTF-006** Implement pending approvals reminder job. ✅ DONE (Session 1 — `NotificationSchedulerService`)
- [x] **TSK-NTF-007** Implement leave/timesheet status change notifications. ✅ DONE (Session 1 — triggers in `ApprovalsController` + `LeaveController`)
- [ ] **TSK-NTF-008** Add per-user configurable notification preferences (opt-in/out per type). *(Genuinely pending — covered by Sprint 13 TSK-PRF-004..006)*

---

## Epic E10 — Audit and Compliance

### E10-F1 Audit Trail
- [x] **TSK-AUD-001** Create AuditLog schema.
- [x] **TSK-AUD-002** Add audit hooks for timesheet CRUD. ✅ DONE (Session 1 — `TimesheetsController` UpsertEntry/DeleteEntry/Submit)
- [x] **TSK-AUD-003** Add audit hooks for leave and approval actions. ✅ DONE (Session 1 — `ApprovalsController` Decide + `LeaveController` ApplyLeave/ReviewLeave)
- [x] **TSK-AUD-004** Add audit hooks for admin/policy changes. ✅ DONE (Session 1 — `IAuditService` injected across controllers)
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
- [x] **TSK-ADM-004** Create Holiday schema and admin CRUD APIs. ✅ DONE (Session 1 — `Holiday.cs`, `HolidaysController.cs`, seed data)
- [x] **TSK-ADM-005** Build holiday calendar UI. ✅ DONE (Session 2 — `Admin/Holidays.tsx` with year filter, create/edit/delete)
- [x] **TSK-ADM-006** Integrate holiday logic into expected-hours calculations. ✅ DONE (Session 7 — holiday deduction in `GetWeek()`, PR #32)

---

## Epic E12 — Engineering Quality, Delivery, and DevOps

### E12-F1 Architecture and Code Quality
- [x] **TSK-ENG-001** Set up backend solution structure (API/Application/Domain/Infrastructure).
- [x] **TSK-ENG-002** Set up frontend module structure (auth/dashboard/attendance/timesheet/etc.).
- [x] **TSK-ENG-003** Add API versioning and standardized error response format. ✅ DONE (Session 1 — global `UseExceptionHandler` returning RFC 7807 `ProblemDetails` with `traceId`)
- [x] **TSK-ENG-004** Add request validation framework. ✅ DONE (Session 1 — `[Required]`, `[MaxLength]`, `[EmailAddress]`, `[Range]` DataAnnotations on all 10 DTO files)
- [x] **TSK-ENG-005** Add structured logging and correlation IDs. ✅ DONE (Session 1 — Serilog + `CorrelationIdMiddleware` `X-Correlation-ID` header)

### E12-F2 Database and Migration
- [x] **TSK-DB-001** Create normalized SQL Server schema scripts/migrations.
- [x] **TSK-DB-002** Add seed data for roles, statuses, leave types, task categories. ✅ DONE (Session 1 — `DbInitializer.cs` IsBillable seeds + holiday seeds)
- [x] **TSK-DB-003** Add database indexing for report-heavy queries. ✅ DONE (Session 1 — `HasIndex()` on WorkSession, Timesheet, TimesheetEntry, LeaveRequest; `db/schema.sql` updated)

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
- [ ] TSK-APR-009 — `GET /approvals/stats` for KPI cards. *(Backend pending — scheduled for Sprint 13)*

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

### Sprint 13 — User Profile & Self-Service ✅ DONE
**Branch:** `feature/sprint-13-user-profile`
**Goal:** Users can manage their own account without admin intervention. Also clears two long-pending carry-overs: Approvals KPI stats (TSK-APR-009) and per-user notification preferences (TSK-NTF-008).

#### Backend — Carry-overs from previous sprints
- [x] **TSK-APR-009** `GET /approvals/stats` — return `{ approvedThisMonth, rejectedThisMonth, avgResponseHours }`. Query: count `Approved`/`Rejected` status timesheets where `ApprovedAtUtc` is in current month; avg hours = mean of `(ApprovedAtUtc - SubmittedAtUtc)` in hours. *(Frontend KPI cards already show `—` placeholders waiting for this)*

#### Backend — New
- [x] **TSK-PRF-001** `GET /users/me` — return full profile (username, email, employeeId, role, dept, workPolicy, leavePolicy, managerId, notificationPrefs).
- [x] **TSK-PRF-002** `PUT /users/me` — update own display name and email (no role/dept change — admin only).
- [x] **TSK-PRF-003** `PUT /users/me/password` — change password with `currentPassword` + `newPassword`; verify current before updating hash.
- [x] **TSK-PRF-004** New `UserNotificationPreferences` table: `{ userId, onApproval, onRejection, onLeaveStatus, onReminder, emailEnabled, inAppEnabled }`. *(Closes TSK-NTF-008)*
- [x] **TSK-PRF-005** `GET /users/me/notification-preferences` + `PUT /users/me/notification-preferences`.
- [x] **TSK-PRF-006** Integrate preferences into `NotificationSchedulerService` — skip notifications for types the user has disabled.

#### Frontend
- [x] **TSK-PRF-007** `/profile` route + `Profile.tsx` page (admin + all roles).
- [x] **TSK-PRF-008** Profile card: read-only fields (role, dept, employee ID, policy) + editable name/email with inline save.
- [x] **TSK-PRF-009** Password change section: current password + new password with strength meter + confirm.
- [x] **TSK-PRF-010** Notification preferences: toggle grid (approval, rejection, leave status, reminders) × (in-app, email).
- [x] **TSK-PRF-011** Add "My Profile" link in topbar user avatar dropdown.
- [x] **TSK-PRF-012** Wire Approvals KPI cards to `GET /approvals/stats` — replace `—` placeholders with real values.

---

### Sprint 14 — Bulk Timesheet Submission ✅ DONE
**Branch:** `feature/sprint-14-bulk-submit`
**Goal:** Submit an entire week's worth of draft timesheets in one action.

#### Backend
- [x] **TSK-BULK-001** `POST /timesheets/submit-week` — accepts `{ weekStart: "YYYY-MM-DD" }`; finds all `Draft` timesheets for that Mon–Sun range for the calling user; runs the same validation as single-submit for each day; commits all or returns per-day errors.
- [x] **TSK-BULK-002** Response DTO: `{ submitted: ["2026-03-16", ...], skipped: [{ date, reason }], errors: [{ date, message }] }`.
- [x] **TSK-BULK-003** Extend existing `POST /timesheets/{id}/submit` tests to cover the new bulk path.

#### Frontend
- [x] **TSK-BULK-004** "Submit This Week" primary button on weekly timesheet header.
- [x] **TSK-BULK-005** Pre-submit preview modal: table of each day's status (Draft / Already Submitted / No Entries), with warnings for missing days.
- [x] **TSK-BULK-006** Result summary: toast showing "X days submitted, Y skipped" with per-day error details if any failed.

---

### Sprint 15 — Manager Team Status Board ✅ DONE
**Branch:** `feature/sprint-15-team-status`
**Goal:** Managers see every direct report's daily status in one glance with inline actions.

#### Backend
- [x] **TSK-TEAM-001** `GET /manager/team-status?date=YYYY-MM-DD` — for each direct report return:
  - `attendance`: checkedIn | checkedOut | onLeave | absent
  - `checkInTime`, `checkOutTime` (if available)
  - `weekLoggedMinutes`, `weekExpectedMinutes`
  - `todayTimesheetStatus`: draft | submitted | approved | missing
  - `pendingApprovalCount`: number of timesheets awaiting this manager's approval from this user
- [x] **TSK-TEAM-002** `POST /manager/remind/{userId}` — sends a `Notification` of type `MissingTimesheetReminder` to the specified user.

#### Frontend
- [x] **TSK-TEAM-003** `TeamStatus.tsx` page, accessible at `"team"` view (manager + admin only).
- [x] **TSK-TEAM-004** Status table: Avatar · Name · Today Status · Week Progress bar · Timesheet · Actions.
- [x] **TSK-TEAM-005** Filter bar: All / Missing Today / Needs Approval / On Leave.
- [x] **TSK-TEAM-006** Inline actions: [Remind] for missing timesheet, [Approve] jumps to Approvals filtered to that user.
- [x] **TSK-TEAM-007** Add "Team" nav item to AppShell for manager/admin.

#### UX Audit & Bug Fixes (Session 14)
- [x] **TSK-TEAM-008** Full UX audit pass — `StatusBadge` component (WCAG 2.1, icon+text+color), custom `MiniCalendar` (no `<input type="date">`), `WeekBar` progress with tooltip, sticky Pending Actions column, all filter tabs always show badge count, `table-layout: fixed` with `<th>` overflow ellipsis.
- [x] **TSK-TEAM-009** Fix check-in/out times showing UTC instead of local time — `DateTime.SpecifyKind(dt, DateTimeKind.Utc).ToString("O")` in `ManagerController.cs`; frontend uses `new Date(isoUtc).toLocaleTimeString()`.
- [x] **TSK-TEAM-010** `useConfirm` hook for irreversible inline actions; `buildSubtitle` utility with unit tests.

---

### Sprint 16 — Task-Level Timer ⏱ ✅ DONE
**Branch:** `feature/sprint-16-task-timer`
**Goal:** Capture time as it happens — timer auto-creates timesheet entries on stop.

#### Backend
- [x] **TSK-TMR-001** New `TimerSessions` table: `{ id, userId, projectId, categoryId, note, startedAtUtc, stoppedAtUtc, durationMinutes, convertedToEntryId }`.
- [x] **TSK-TMR-002** `GET /timers/active` — returns the currently running timer for the calling user, or 404.
- [x] **TSK-TMR-003** `POST /timers/start` — `{ projectId, categoryId, note? }`; enforces one active timer per user.
- [x] **TSK-TMR-004** `POST /timers/stop` — stops active timer, calculates `durationMinutes`, returns the record. Does NOT auto-create entry (user confirms).
- [x] **TSK-TMR-005** `POST /timers/{id}/convert` — creates a draft timesheet entry from the timer record; sets `convertedToEntryId`.
- [x] **TSK-TMR-006** `GET /timers/history?date=YYYY-MM-DD` — recent timer sessions for the day.

#### Frontend
- [x] **TSK-TMR-007** Persistent timer widget in Timesheets sidebar (replaces/extends current Active Timer section).
- [x] **TSK-TMR-008** Project + Category selector dropdowns on timer start.
- [x] **TSK-TMR-009** Live HH:MM:SS counter when timer running (polling `/timers/active` every 30s to survive page refresh).
- [x] **TSK-TMR-010** Stop → "Add to Timesheet?" confirmation with pre-filled entry form showing computed duration.
- [x] **TSK-TMR-011** Timer persists across page navigation (stored in localStorage with startedAt; reconciled with server on load).

---

### Sprint 17 — Project Budget Burn 📊 ✅ DONE
**Branch:** `feature/sprint-17-project-budget`
**Goal:** Expose `budgetedHours` data as actionable project health indicators.

#### Backend
- [x] **TSK-BDG-001** `GET /projects/{id}/budget-summary` — returns `{ budgetedHours, loggedHours, remainingHours, burnRateHoursPerWeek, projectedWeeksRemaining, weeklyBreakdown: [{ weekStart, hours }] }` (last 8 weeks).
- [x] **TSK-BDG-002** `GET /projects/budget-health` — admin/manager list: all active projects with `{ id, name, budgetedHours, loggedHours, pctUsed, status: "on-track"|"warning"|"critical"|"over-budget" }`. Thresholds: warning ≥80%, critical ≥95%.
- [x] **TSK-BDG-003** `BudgetedHours` validation in `UpsertProjectRequest` — must be ≥ 0.

#### Frontend
- [x] **TSK-BDG-004** Budget burn panel in `Admin/Projects.tsx` edit drawer: burn bar, pct used, projected completion date.
- [x] **TSK-BDG-005** Budget column in Projects table: mini burn bar + pct label; color-coded by status.
- [x] **TSK-BDG-006** Admin dashboard: "Budget Health" card showing count of warning/critical projects with drill-down list.

---

### Sprint 18 — Recurring Entry Templates 📋 ✅ DONE
**Branch:** `feature/sprint-18-entry-templates`
**Goal:** One-click pre-fill for users who log the same entries daily.

#### Backend
- [x] **TSK-TPL-001** New `TimesheetTemplates` table: `{ id, userId, name, createdAt, entries: JSON[] (projectId, categoryId, durationMinutes, note) }`.
- [x] **TSK-TPL-002** `GET /timesheets/templates` — user's saved templates.
- [x] **TSK-TPL-003** `POST /timesheets/templates` — save a named template.
- [x] **TSK-TPL-004** `PUT /timesheets/templates/{id}` — rename or update entries.
- [x] **TSK-TPL-005** `DELETE /timesheets/templates/{id}`.
- [x] **TSK-TPL-006** `POST /timesheets/templates/{id}/apply` — `{ date: "YYYY-MM-DD" }`; creates draft entries for that date from the template; skips if entries already exist; returns created entry IDs.

#### Frontend
- [x] **TSK-TPL-007** "Use Template" button on Timesheets daily view — opens template picker modal.
- [x] **TSK-TPL-008** "Save as Template" option in entry form context menu or week-view actions.
- [x] **TSK-TPL-009** Template management section in `Profile.tsx` — list, rename, delete saved templates.

---

### Sprint 19 — Leave Team Calendar 🗓 ✅ DONE
**Branch:** `feature/sprint-19-leave-team-calendar`
**Goal:** Show who else is off when employees apply for leave; prevent understaffed days.

#### Backend
- [x] **TSK-LTC-001** `GET /leave/team-calendar?year=&month=` — returns approved + pending leaves for all members of the calling user's department (employee) or direct reports (manager). DTO: `{ date, entries: [{ userId, username, leaveTypeName, status }] }`.
- [x] **TSK-LTC-002** `GET /leave/conflicts?fromDate=&toDate=&userId=` — returns count of team members on leave during the requested dates; used for conflict warning on apply form.

#### Frontend
- [x] **TSK-LTC-003** Enhance Leave page mini calendar: overlay team leave chips (small colored dots per user) on each date alongside personal leave dots.
- [x] **TSK-LTC-004** Conflict warning banner on leave apply form: "3 team members are already off during these dates: [names]."
- [x] **TSK-LTC-005** Tooltip on calendar date: hover shows list of who is off that day.

---

### Sprint 20 — Anomaly Detection & Alerts 🔔 ✅ DONE
**Branch:** `feature/sprint-20-anomaly-alerts`
**Goal:** Surface unusual patterns automatically so admins don't need to hunt in reports.

#### Backend
- [x] **TSK-ANM-001** New `AnomalyRules` enum: `ExcessiveDailyHours` (>12h), `ExtendedMissingTimesheet` (>5 consecutive working days), `ProjectBudgetWarning` (≥80%), `ProjectBudgetCritical` (≥95%), `ComplianceDropped` (team compliance down ≥15% vs prior month).
- [x] **TSK-ANM-002** `AnomalyDetectionService` — background service, runs daily at 07:00 UTC; evaluates all rules; creates `Notification` records with `Type = Anomaly`, deduplicates (don't re-alert same anomaly within 7 days).
- [x] **TSK-ANM-003** `GET /admin/anomalies` — active unresolved anomaly notifications; supports `?severity=warning|critical` filter.
- [x] **TSK-ANM-004** `POST /admin/anomalies/{id}/dismiss` — marks anomaly notification as dismissed.

#### Frontend
- [x] **TSK-ANM-005** "Anomaly Alerts" panel on admin dashboard — shows active alerts grouped by severity (critical first). Each: icon, description, affected entity, [Dismiss] button, [Investigate →] link to relevant page.
- [x] **TSK-ANM-006** Anomaly notifications appear in the notification bell with a distinct icon.

---

### Sprint 21 — Saved & Scheduled Reports + True Export 📧
**Branch:** `feature/sprint-21-saved-reports`
**Goal:** Reports are persistent and can be auto-delivered without manual action. Also fixes the long-standing broken Excel/PDF export (TSK-RPT-008/009 — currently both return corrupt files).

#### Backend — Carry-overs (True Export)
- [ ] **TSK-RPT-008** True Excel export — add `EPPlus` (non-commercial) or `ClosedXML` NuGet package; replace `BuildRawReport()` CSV bytes with a real `.xlsx` workbook with formatted headers, auto-column widths, and frozen top row. *(Currently returns CSV bytes with `application/vnd.openxmlformats` MIME — opens as corrupt in Excel)*
- [ ] **TSK-RPT-009** True PDF export — add `QuestPDF` or `PdfSharpCore` NuGet; generate a formatted A4 report with title, date range, table data, and footer. *(Currently returns CSV bytes with `application/pdf` MIME)*

#### Backend — New (Saved Reports)
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

### Sprint 24 — Mobile PWA 📱 ✅ DONE
**Branch:** `feature/sprint-24-mobile-pwa` → **merged to master**
**Commit:** `b3d64ae`

#### Backend ✅
- [x] `PushSubscription` entity + EF config (`PushSubscriptions` table, unique index on Endpoint)
- [x] EF migration `Sprint24_PushSubscriptions`
- [x] `PushController` — `GET /api/v1/push/vapid-key`, `POST /subscribe`, `POST /unsubscribe`
- [x] `WebPushService` (stub — wire real VAPID library before production)
- [x] VAPID config section in `appsettings.json` (replace placeholder keys before go-live)

#### Frontend ✅
- [x] `vite-plugin-pwa` configured with Workbox (NetworkFirst for `/api`, CacheFirst for fonts)
- [x] Web App Manifest — standalone display, indigo theme, all icon sizes
- [x] `InstallPrompt.tsx` — bottom banner, `beforeinstallprompt` event, localStorage dismissal
- [x] `usePushNotifications.ts` — VAPID subscribe/unsubscribe hook
- [x] `/public/offline.html` — offline fallback page
- [x] PWA meta tags in `index.html` (theme-color, apple-mobile-web-app-capable, apple-touch-icon)
- [x] `/public/icons/` — SVG + placeholder PNGs (replace with real icons before production)

---

### Sprint 25 — Dark Mode 🌙 ✅ DONE
**Branch:** `feature/sprint-25-dark-mode` → **merged to master**
**Commit:** `67e6c3c`

#### Frontend ✅
- [x] `[data-theme="dark"]` CSS block — full neutral/brand/semantic palette inversion
- [x] Sidebar, topbar, card, modal, table, input, scrollbar dark overrides
- [x] `ThemeContext.tsx` — `ThemeProvider`, `useTheme`, light/dark/system modes, localStorage persistence
- [x] `ThemeToggle.tsx` — cycles ☀️/🌙/💻, placed in AppShell topbar
- [x] Flash-prevention inline script in `index.html` (runs before React hydrates)
- [x] Smooth 150ms color transitions on all elements

---

### Sprint 26 — UX Foundation ✅ DONE
**Branch:** `feature/sprint-26-ux-foundation` → **merged to master**
**Commit:** `483e3f1`

#### Frontend ✅
- [x] `ToastContext.tsx` — `ToastProvider`, `useToast()` with `success/error/warning/info`, auto-dismiss, max 5 stacked
- [x] `ToastContainer.tsx` — fixed top-right, slide-in animation, colour-coded left border
- [x] `Skeleton.tsx` — `Skeleton`, `SkeletonKPI`, `SkeletonTableRows`, `SkeletonListItem`, `SkeletonPage` with shimmer CSS animation
- [x] `EmptyState.tsx` — `EmptyState` + presets: `EmptyTimesheets`, `EmptyLeave`, `EmptyApprovals`, `EmptyReports`, `EmptySearch`, `EmptyNotifications`
- [x] `ErrorBoundary.tsx` — class-based per-route isolation + `SectionErrorBoundary`
- [x] `ConfirmDialog.tsx` — `ConfirmProvider`, promise-based `useConfirm()`, danger/warning/default variants
- [x] Shimmer + modal entry animations in `design-system.css`
- [x] `App.tsx` — all providers wired: `ThemeProvider > ToastProvider > ConfirmProvider`; `ErrorBoundary` on every route
- [x] Skeleton loading states on Dashboard, Timesheets, Leave, Approvals, Reports
- [x] Empty states on Timesheets, Leave, Approvals, Reports
- [x] Login errors fire `toast.error()`

#### Usage patterns for agents
```tsx
// Toast
const toast = useToast();
toast.success("Saved!", "Timesheet submitted.");
toast.error("Failed", "Could not connect.");

// Confirm
const confirm = useConfirm();
const ok = await confirm({ title: "Delete?", message: "Cannot be undone.", variant: "danger", confirmLabel: "Delete" });
if (ok) deleteItem(id);

// Skeleton (in loading state)
if (loading) return <SkeletonPage kpis={4} rows={6} cols={4} />;

// Empty state
if (!data.length) return <EmptyTimesheets onAdd={openForm} />;
```

---

## Phase 4 — International SaaS UX Sprints

> **Context for agents:** The app is a multi-role workforce management SaaS (employee / manager / admin).
> Stack: React 18 + TypeScript + Vite + Tailwind v4 + CSS custom properties in `design-system.css`.
> Backend: .NET 10, Clean Architecture, CQRS/MediatR, EF Core 9, SQL Server.
> Base branch for all new work: `master`.
> Branch naming: `feature/sprint-<N>-<slug>`.
> After each sprint: `npx tsc --noEmit` must pass before committing.

---

### Sprint 27 — Multi-Timezone Support 🌍
**Branch:** `feature/sprint-27-multi-timezone`
**Status:** `TODO`
**Goal:** Every user can set their local timezone; all time displays respect it. Foundation for global teams.

#### Backend
- [ ] **TZ-001** Add `TimeZoneId` (string, IANA format e.g. `"Asia/Kolkata"`) to `User` entity in `src/TimeSheet.Domain/Entities/User.cs`
- [ ] **TZ-002** EF migration `Sprint27_UserTimezone` — nullable column with default `"UTC"`
- [ ] **TZ-003** `GET /api/v1/profile` — include `timeZoneId` in response DTO
- [ ] **TZ-004** `PUT /api/v1/profile` — accept and save `timeZoneId`
- [ ] **TZ-005** `GET /api/v1/timezones` — return list of all IANA timezone IDs with display names (use `TimeZoneInfo.GetSystemTimeZones()`)
- [ ] **TZ-006** All datetime fields returned by API must include UTC offset or be explicitly UTC — audit `TimesheetsController`, `LeaveController`, `AttendanceController` response DTOs

#### Frontend
- [ ] **TZ-007** `useTimezone` hook — reads user's `timeZoneId` from session; exposes `toLocal(utcDate)` and `toUtc(localDate)` helpers using `Intl.DateTimeFormat`
- [ ] **TZ-008** `TimezoneSelect.tsx` — searchable dropdown of IANA zones; used in Profile settings
- [ ] **TZ-009** Update `Profile.tsx` — add Timezone section with `TimezoneSelect`; save via `PUT /api/v1/profile`; show `toast.success()` on save
- [ ] **TZ-010** Update `Timesheets.tsx` — display entry times in user's local timezone via `useTimezone`
- [ ] **TZ-011** Update `AttendanceWidget.tsx` — show clock-in/out times in local timezone
- [ ] **TZ-012** Update `Dashboard.tsx` — all time displays use `useTimezone`
- [ ] **TZ-013** Topbar clock (optional): small live clock showing user's local time

#### Acceptance criteria
- User in `Asia/Kolkata` sees IST times; user in `America/New_York` sees EST/EDT times
- Changing timezone in Profile immediately updates all displayed times
- All API calls still send/receive UTC; conversion is client-side only
- `npx tsc --noEmit` passes

---

### Sprint 28 — Onboarding Flow 🎯
**Branch:** `feature/sprint-28-onboarding`
**Status:** `TODO`
**Goal:** First-login wizard and setup checklist to reduce time-to-value for new users and admins.

#### Backend
- [ ] **ON-001** Add `OnboardingCompletedAt` (DateTime?, nullable) to `User` entity
- [ ] **ON-002** EF migration `Sprint28_Onboarding`
- [ ] **ON-003** `POST /api/v1/onboarding/complete` — sets `OnboardingCompletedAt = UtcNow` for current user
- [ ] **ON-004** `GET /api/v1/onboarding/checklist` — returns checklist state: `{ hasSubmittedTimesheet, hasAppliedLeave, hasSetTimezone, hasSetNotificationPrefs }` derived from existing data

#### Frontend
- [ ] **ON-005** `OnboardingWizard.tsx` — multi-step modal (3 steps: Welcome → Set timezone → Set notifications → Done). Shown only when `session.onboardingCompletedAt` is null
- [ ] **ON-006** Step 1 — Welcome: app overview, role explanation (employee/manager/admin)
- [ ] **ON-007** Step 2 — Timezone: embed `TimezoneSelect` from Sprint 27; auto-detect from `Intl.DateTimeFormat().resolvedOptions().timeZone`
- [ ] **ON-008** Step 3 — Notifications: toggle push notifications (use `usePushNotifications` hook from Sprint 24)
- [ ] **ON-009** `OnboardingChecklist.tsx` — collapsible panel on Dashboard for users who haven't done all steps. Shows progress (e.g. "3/5 complete"). Each item links to the relevant page
- [ ] **ON-010** Mount `OnboardingWizard` in `App.tsx` inside `AppRoutes` — only renders when `session && !session.onboardingCompletedAt`
- [ ] **ON-011** Admin checklist items: Add first project, Add leave policies, Add holidays, Add first user

#### Acceptance criteria
- New user sees wizard on first login; sees nothing on subsequent logins
- Wizard can be dismissed (skips onboarding, marks complete)
- Checklist disappears once all items are done
- `npx tsc --noEmit` passes

---

### Sprint 29 — Notification Centre 2.0 🔔
**Branch:** `feature/sprint-29-notification-centre`
**Status:** `TODO`
**Goal:** Rich, grouped notification feed with preferences UI. Replace the basic notification bell.

#### Backend
- [ ] **NC-001** Add `GroupKey` (string, nullable) and `ActionUrl` (string, nullable) to `Notification` entity — EF migration `Sprint29_NotificationEnhancements`
- [ ] **NC-002** `GET /api/v1/notifications` — add `?page=1&pageSize=20` pagination; return `{ items, totalUnread, hasMore }`
- [ ] **NC-003** `POST /api/v1/notifications/mark-all-read` — mark all unread as read for current user
- [ ] **NC-004** `DELETE /api/v1/notifications/{id}` — delete a single notification
- [ ] **NC-005** `DELETE /api/v1/notifications` — clear all notifications for current user

#### Frontend
- [ ] **NC-006** Redesign `Notifications.tsx` — replace simple dropdown with a slide-over panel (right side, 380px wide)
- [ ] **NC-007** Group notifications by day: "Today", "Yesterday", "Earlier this week", "Older"
- [ ] **NC-008** Each notification item: icon (based on type), title, message, relative time, unread dot, click to dismiss + navigate to `actionUrl`
- [ ] **NC-009** "Mark all read" button in panel header
- [ ] **NC-010** "Clear all" button with `useConfirm()` confirm dialog
- [ ] **NC-011** Infinite scroll / "Load more" for pagination
- [ ] **NC-012** `EmptyNotifications` empty state (already exists in `EmptyState.tsx`)
- [ ] **NC-013** Notification preferences page in `Profile.tsx` — toggles per notification type (timesheet approved/rejected, leave approved/rejected, anomaly alerts)
- [ ] **NC-014** Unread count badge on bell — animate when count changes (CSS keyframe pulse)

#### Acceptance criteria
- Panel opens/closes smoothly
- Grouped by date, newest first
- Mark all read clears the badge instantly
- Preferences saved and respected
- `npx tsc --noEmit` passes

---

### Sprint 30 — SignalR Real-time 📡
**Branch:** `feature/sprint-30-signalr-realtime`
**Status:** `TODO`
**Goal:** Live updates without polling — approval status changes, team clock-in feed, dashboard counters.

#### Backend
- [ ] **SR-001** Install `Microsoft.AspNetCore.SignalR` (already included in .NET 10 ASP.NET Core)
- [ ] **SR-002** `TimeSheetHub.cs` in `apps/api/Hubs/` — hub with groups: `user-{userId}`, `manager-{managerId}`, `all`
- [ ] **SR-003** Map hub in `Program.cs`: `app.MapHub<TimeSheetHub>("/hubs/timesheet")`
- [ ] **SR-004** Add CORS policy to allow SignalR WebSocket upgrade
- [ ] **SR-005** Publish `TimesheetStatusChanged` event from `UnitOfWork` domain event dispatcher → `IHubContext<TimeSheetHub>` → send to `user-{userId}` group
- [ ] **SR-006** Publish `LeaveStatusChanged` event similarly
- [ ] **SR-007** Publish `TeamClockIn` event from `AttendanceController.CheckIn` → send to `manager-{managerId}` group
- [ ] **SR-008** `GET /api/v1/notifications/count` — lightweight endpoint for initial unread count

#### Frontend
- [ ] **SR-009** Install `@microsoft/signalr`: `npm install @microsoft/signalr -w apps/web`
- [ ] **SR-010** `useSignalR.ts` hook — manages connection lifecycle, auto-reconnect, typed message handlers
- [ ] **SR-011** `SignalRProvider.tsx` — context that establishes connection after login; exposes `useSignalR()` hook. Add to `App.tsx` inside `AppRoutes` (after session is confirmed)
- [ ] **SR-012** Dashboard — subscribe to `DashboardUpdated` event; refresh KPI counters without full page reload
- [ ] **SR-013** Approvals page — subscribe to `TimesheetSubmitted`; show `toast.info()` "New timesheet submitted by [name]" + auto-refresh list
- [ ] **SR-014** Timesheets page — subscribe to `TimesheetStatusChanged` for own timesheets; update status badges live; show `toast.success/error()`
- [ ] **SR-015** Leave page — subscribe to `LeaveStatusChanged`; update status live
- [ ] **SR-016** Notification bell — subscribe to `NewNotification` event; increment unread count + pulse animation; add new item to panel if open
- [ ] **SR-017** Connection status indicator in topbar (small dot: green = connected, yellow = reconnecting, hidden when connected)

#### Acceptance criteria
- Manager sees approval badge increment in real time when employee submits timesheet
- Employee sees status change (Approved/Rejected) without refresh
- Connection recovers automatically after network interruption
- `npx tsc --noEmit` passes

---

### Sprint 31 — Billing & Subscription 💳
**Branch:** `feature/sprint-31-billing`
**Status:** `TODO`
**Goal:** Plan/subscription management page for SaaS monetization. UI-only initially (no payment processor integration required in this sprint).

#### Backend
- [ ] **BL-001** `Subscription` entity: `Id`, `TenantId` (string), `Plan` (enum: Free/Starter/Pro/Enterprise), `Status` (Active/Cancelled/PastDue), `UserLimit`, `CurrentUserCount`, `BillingCycleEnd` (DateTime)
- [ ] **BL-002** EF migration `Sprint31_Billing`
- [ ] **BL-003** `GET /api/v1/billing/subscription` — returns current subscription for org (admin only)
- [ ] **BL-004** `GET /api/v1/billing/invoices` — returns mock invoice history array
- [ ] **BL-005** `GET /api/v1/billing/usage` — returns `{ activeUsers, userLimit, timesheetCount, storageUsedMb }`

#### Frontend
- [ ] **BL-006** Add `"billing"` to `View` type in `types.ts`; add route `/billing` (admin only) in `App.tsx` and `AppShell` nav
- [ ] **BL-007** `Billing.tsx` — page with three sections: Current Plan card, Usage meters, Invoice history table
- [ ] **BL-008** Plan card: show plan name, status badge, renewal date, user count vs limit progress bar. "Upgrade Plan" button (links to pricing — no-op for now)
- [ ] **BL-009** Usage meters: animated progress bars for active users, timesheet entries, storage. Red warning at 80%+ usage
- [ ] **BL-010** Invoice table: date, amount, status (Paid/Pending), download link (stub)
- [ ] **BL-011** Upgrade prompt banner: shown on Dashboard when user count > 80% of limit. Dismissible via `localStorage`

#### Acceptance criteria
- `/billing` accessible to admin only; redirect non-admins to dashboard
- Plan card, usage meters, and invoice table all render from API data
- Skeleton loading state while data fetches
- Empty state for invoices
- `npx tsc --noEmit` passes

---

### Sprint 32 — SSO / SAML 🔐
**Branch:** `feature/sprint-32-sso`
**Status:** `TODO`
**Goal:** Google Workspace and Microsoft 365 login for enterprise customers.

#### Backend
- [ ] **SSO-001** Install `Microsoft.AspNetCore.Authentication.Google` and `Microsoft.AspNetCore.Authentication.MicrosoftAccount`
- [ ] **SSO-002** Add SSO config to `appsettings.json`: `"Sso": { "Google": { "ClientId": "", "ClientSecret": "" }, "Microsoft": { "ClientId": "", "ClientSecret": "" } }`
- [ ] **SSO-003** `GET /api/v1/auth/sso/google` — redirects to Google OAuth consent screen
- [ ] **SSO-004** `GET /api/v1/auth/sso/google/callback` — handles OAuth callback; finds or creates `User` by email; returns same JWT + refresh token as regular login
- [ ] **SSO-005** Same pattern for Microsoft (`/sso/microsoft`, `/sso/microsoft/callback`)
- [ ] **SSO-006** Add `SsoProvider` (enum: None/Google/Microsoft) and `SsoSubject` (string) to `User` entity — EF migration `Sprint32_SsoFields`
- [ ] **SSO-007** `GET /api/v1/auth/sso/providers` — returns which providers are configured (so frontend shows/hides buttons)

#### Frontend
- [ ] **SSO-008** Update `Login.tsx` — fetch `/auth/sso/providers` on mount; conditionally show "Continue with Google" and/or "Continue with Microsoft" buttons below the form divider
- [ ] **SSO-009** SSO buttons: branded (Google blue, Microsoft blue), SVG logos, full-width, above the email/password form
- [ ] **SSO-010** Handle OAuth redirect return: detect `?token=...&refresh=...` query params in URL after SSO callback; call `login()` with the session; redirect to dashboard
- [ ] **SSO-011** Admin panel: SSO configuration page under Settings — shows connected providers, enable/disable toggles, domain restriction field (only allow `@company.com` emails)

#### Acceptance criteria
- "Continue with Google" button visible only when Google SSO is configured
- OAuth flow completes and user lands on Dashboard with valid session
- SSO users can't change password (show "Managed by SSO" instead)
- `npx tsc --noEmit` passes

---

### Sprint 33 — Public API + Webhooks 🔗
**Branch:** `feature/sprint-33-public-api`
**Status:** `TODO`
**Goal:** Let enterprise customers integrate TimeSheet with their own systems.

#### Backend
- [ ] **API-001** `ApiKey` entity: `Id`, `UserId`, `Name`, `KeyHash` (bcrypt), `Prefix` (first 8 chars, shown to user), `Scopes` (string array), `LastUsedAt`, `ExpiresAt` (nullable), `CreatedAt`
- [ ] **API-002** EF migration `Sprint33_ApiKeys`
- [ ] **API-003** `ApiKeyAuthenticationHandler` — reads `X-Api-Key` header; validates against hashed keys; sets `ClaimsPrincipal`
- [ ] **API-004** Register API key auth scheme alongside JWT in `Program.cs`
- [ ] **API-005** `ApiKeysController` — `GET /api/v1/developer/keys`, `POST /api/v1/developer/keys` (generate + return full key once), `DELETE /api/v1/developer/keys/{id}`
- [ ] **API-006** `Webhook` entity: `Id`, `UserId`, `Url`, `Events` (string array), `Secret`, `IsActive`, `LastTriggeredAt`
- [ ] **API-007** EF migration `Sprint33_Webhooks`
- [ ] **API-008** `WebhooksController` — CRUD endpoints for webhook registrations
- [ ] **API-009** `WebhookDispatchService` — sends signed `POST` requests (HMAC-SHA256 `X-Signature` header) on events: `timesheet.submitted`, `timesheet.approved`, `leave.approved`, `user.created`
- [ ] **API-010** `WebhookLog` entity + `GET /api/v1/developer/webhooks/{id}/deliveries` — last 50 delivery attempts with status/response

#### Frontend
- [ ] **API-011** Add `"developer"` to `View` type; add `/developer` route (admin only)
- [ ] **API-012** `Developer.tsx` — tabbed page: "API Keys" tab + "Webhooks" tab
- [ ] **API-013** API Keys tab: table of keys (name, prefix, scopes, last used, expiry); "Create Key" button → modal with name + scope checkboxes → show full key once in a copy-to-clipboard box with warning "Store this key securely"
- [ ] **API-014** Webhooks tab: table of webhooks (url, events, status, last triggered); "Add Webhook" modal — URL input, event checkboxes, auto-generate secret; delivery log expandable row
- [ ] **API-015** Use `useConfirm()` for key deletion and webhook deletion

#### Acceptance criteria
- Full key shown only at creation time; only prefix shown thereafter
- Webhook delivery log shows success/failure per delivery
- `npx tsc --noEmit` passes

---

### Sprint 34 — Overtime & Comp-off Rules Engine ⏱️
**Branch:** `feature/sprint-34-overtime-rules`
**Status:** `TODO`
**Goal:** Policy-driven overtime detection and automatic comp-off credit.

#### Backend
- [ ] **OT-001** `OvertimePolicy` entity: `Id`, `WorkPolicyId` (FK), `DailyOvertimeAfterHours` (decimal), `WeeklyOvertimeAfterHours` (decimal), `OvertimeMultiplier` (decimal, e.g. 1.5), `CompOffEnabled` (bool), `CompOffExpiryDays` (int)
- [ ] **OT-002** EF migration `Sprint34_OvertimePolicy`
- [ ] **OT-003** `OvertimeCalculationService` — given a user's week of `TimesheetEntry` rows, returns `{ regularHours, overtimeHours, compOffCredits }`
- [ ] **OT-004** `CompOffBalance` entity: `UserId`, `Credits` (decimal), `ExpiresAt` (DateTime)
- [ ] **OT-005** Background job: run weekly, calculate overtime for approved timesheets, credit comp-off balances
- [ ] **OT-006** `GET /api/v1/overtime/summary?userId=&weekStart=` — returns overtime breakdown for a week
- [ ] **OT-007** `GET /api/v1/leave/comp-off-balance` — returns current comp-off credits for user

#### Frontend
- [ ] **OT-008** `WorkPolicies.tsx` — add "Overtime Rules" collapsible section inside each policy card: daily/weekly threshold inputs, multiplier input, comp-off toggle
- [ ] **OT-009** `Timesheets.tsx` — weekly summary sidebar: add "Overtime" row when hours exceed policy threshold (highlight in amber)
- [ ] **OT-010** `Leave.tsx` — add "Comp-off" as a leave type option; show available comp-off balance in the balance cards
- [ ] **OT-011** `Dashboard.tsx` (manager view) — add "Overtime Hours" KPI card showing team overtime for current week

#### Acceptance criteria
- Overtime highlighted in timesheets when daily/weekly thresholds exceeded
- Comp-off balance visible in leave page
- Policy changes take effect from next calculation cycle
- `npx tsc --noEmit` passes

---

### Sprint 35 — Slack / Teams Integration 💬
**Branch:** `feature/sprint-35-slack-teams`
**Status:** `TODO`
**Goal:** Approval actions directly from Slack/Teams; daily digest notifications.

#### Backend
- [ ] **SL-001** `SlackIntegration` entity: `Id`, `WorkspaceId`, `AccessToken` (encrypted), `BotUserId`, `WebhookUrl`, `IsActive`
- [ ] **SL-002** EF migration `Sprint35_Integrations`
- [ ] **SL-003** `POST /api/v1/integrations/slack/oauth` — handles Slack OAuth callback; stores token
- [ ] **SL-004** `POST /api/v1/integrations/slack/actions` — handles Slack interactive payload (approve/reject buttons)
- [ ] **SL-005** `SlackNotificationService` — sends Block Kit messages: timesheet submitted (with Approve/Reject buttons for managers), leave approved (for employees)
- [ ] **SL-006** Background job: daily digest at 9am per user timezone — sends pending approvals summary to manager's Slack DM
- [ ] **SL-007** Same pattern for Microsoft Teams (`TeamsIntegration`, Adaptive Cards, webhook-based)

#### Frontend
- [ ] **SL-008** `Integrations.tsx` — admin page (`/integrations` route): cards for Slack and Teams, each with "Connect" button and status (Connected/Not connected)
- [ ] **SL-009** Slack card: "Connect with Slack" OAuth button; when connected shows workspace name, bot user, disconnect button, and toggle for digest notifications
- [ ] **SL-010** Teams card: same pattern with Teams branding
- [ ] **SL-011** `Profile.tsx` — "Connected Apps" section: user can link their personal Slack account for direct message notifications
- [ ] **SL-012** Add `"integrations"` to `View` type and admin nav in `AppShell`

#### Acceptance criteria
- Admin can connect Slack workspace via OAuth
- Manager receives Slack message with Approve/Reject buttons when timesheet submitted
- Clicking Approve in Slack calls `/api/v1/integrations/slack/actions` and updates status
- `npx tsc --noEmit` passes

---

### Sprint 36 — AI Smart Fill 🤖
**Branch:** `feature/sprint-36-ai-smart-fill`
**Status:** `TODO`
**Goal:** AI-powered timesheet pre-fill and anomaly explanation using Claude API.

#### Backend
- [ ] **AI-001** Install `Anthropic` NuGet (or use HTTP client) — store `ANTHROPIC_API_KEY` in environment / Key Vault
- [ ] **AI-002** `AiService.cs` — `SuggestTimesheetEntries(userId, weekStart)`: fetches last 4 weeks of entries, builds prompt, calls Claude claude-sonnet-4-6, returns suggested entries JSON
- [ ] **AI-003** `POST /api/v1/ai/suggest-entries` — calls `AiService`; returns array of suggested `{ projectId, taskCategoryId, hours, description }`
- [ ] **AI-004** `POST /api/v1/ai/explain-anomaly` — given an anomaly alert ID, returns a plain-English explanation and suggested action

#### Frontend
- [ ] **AI-005** `Timesheets.tsx` — "Smart Fill" button in the weekly header: calls `/ai/suggest-entries`, shows suggestions in a modal with checkboxes, "Apply selected" adds them as draft entries
- [ ] **AI-006** Suggestions modal: each row shows project, category, hours, description + editable hours field; "Apply All" and "Apply Selected" buttons
- [ ] **AI-007** `Dashboard.tsx` — anomaly alert cards: add "Explain" button that calls `/ai/explain-anomaly` and shows explanation in a tooltip/popover
- [ ] **AI-008** Loading states for AI calls (skeleton + "Thinking…" text)
- [ ] **AI-009** Error handling: if AI call fails, `toast.error("Smart Fill unavailable", "Try again later.")`

#### Acceptance criteria
- Smart Fill button visible only when user has at least 2 weeks of history
- Suggestions are pre-filled but user must confirm before entries are saved
- AI anomaly explanation is plain English, under 100 words
- `npx tsc --noEmit` passes

---

### Sprint 37 — Capacity Planning 📊
**Branch:** `feature/sprint-37-capacity-planning`
**Status:** `TODO`
**Goal:** Team workload heatmap and project allocation view for managers.

#### Backend
- [ ] **CP-001** `GET /api/v1/capacity/team?weekStart=&weeks=4` — returns per-user, per-week allocated hours vs available hours
- [ ] **CP-002** `GET /api/v1/capacity/projects?month=` — returns per-project hours breakdown across team
- [ ] **CP-003** `GET /api/v1/capacity/overallocated` — returns users with allocated > 100% for current/next week

#### Frontend
- [ ] **CP-004** Add `"capacity"` to `View` type; route `/capacity` (manager + admin)
- [ ] **CP-005** `CapacityPlanning.tsx` — two-tab page: "Team Heatmap" + "Project Allocation"
- [ ] **CP-006** Team Heatmap tab: grid of users × weeks; each cell is colour-coded: green (<80%), amber (80-100%), red (>100%); hover shows hours detail
- [ ] **CP-007** Project Allocation tab: horizontal stacked bar per project — allocated hours vs budget
- [ ] **CP-008** Overallocation banner: if any user is overallocated next week, show warning banner at top with names
- [ ] **CP-009** Week navigator: prev/next week controls; default to current week

#### Acceptance criteria
- Heatmap renders correctly with colour coding
- Clicking a cell shows a popover with the user's entries for that week
- `npx tsc --noEmit` passes

---

### Sprint 38 — GDPR / Compliance Toolkit 🔒
**Branch:** `feature/sprint-38-gdpr`
**Status:** `TODO`
**Goal:** Data subject rights, consent logging, and retention policies for EU compliance.

#### Backend
- [ ] **GD-001** `DataExportRequest` entity: `Id`, `UserId`, `RequestedAt`, `CompletedAt`, `DownloadUrl`
- [ ] **GD-002** EF migration `Sprint38_GdprEntities`
- [ ] **GD-003** `POST /api/v1/privacy/export-request` — queues a data export job for the requesting user
- [ ] **GD-004** Background job: generates JSON/CSV export of all user data (timesheets, leave, profile), stores as downloadable file, notifies user
- [ ] **GD-005** `POST /api/v1/privacy/delete-account` — anonymises all user PII (name → "Deleted User", email → `deleted-{id}@anon.local`); keeps aggregate data for reports
- [ ] **GD-006** `ConsentLog` entity: `UserId`, `ConsentType`, `Granted` (bool), `Timestamp`, `IpAddress`
- [ ] **GD-007** `POST /api/v1/privacy/consent` — logs consent grant/revoke
- [ ] **GD-008** `GET /api/v1/admin/retention-policy` / `PUT` — configure how long to keep data per type (timesheets: 7 years, logs: 1 year, etc.)
- [ ] **GD-009** Retention enforcement background job: purge records older than policy

#### Frontend
- [ ] **GD-010** `Profile.tsx` — "Privacy & Data" section: "Download my data" button (calls export request, shows `toast.info("Export queued. You'll receive a notification when ready.")`), "Delete my account" (uses `useConfirm()` with danger variant)
- [ ] **GD-011** Cookie/consent banner: shown on first visit (before login); stores consent in localStorage + logs to backend on login
- [ ] **GD-012** Admin — `RetentionPolicy.tsx` panel under Settings: configure retention periods per data type with number inputs + "Save" button
- [ ] **GD-013** Admin — audit log viewer: searchable, paginated table of `AuditLog` entries (already exists in backend)

#### Acceptance criteria
- Data export request creates a downloadable file within 60 seconds (background job)
- Account deletion anonymises PII but retains aggregate report data
- Consent banner shown once; not shown again after acceptance
- `npx tsc --noEmit` passes

---

### Sprint 39 — White-label & Theming 🎨
**Branch:** `feature/sprint-39-white-label`
**Status:** `TODO`
**Goal:** Organisations can upload their logo, set brand colours, and use a custom domain.

#### Backend
- [ ] **WL-001** `TenantSettings` entity: `Id`, `TenantId`, `LogoUrl`, `PrimaryColor` (hex), `AppName`, `CustomDomain` (nullable), `FaviconUrl`
- [ ] **WL-002** EF migration `Sprint39_TenantSettings`
- [ ] **WL-003** `GET /api/v1/tenant/settings` — public endpoint (no auth) used at app load to fetch branding
- [ ] **WL-004** `PUT /api/v1/tenant/settings` — admin only; accepts `multipart/form-data` for logo upload
- [ ] **WL-005** Logo stored in `wwwroot/uploads/` (or blob storage); resized to max 200×60px on upload

#### Frontend
- [ ] **WL-006** `useTenantSettings` hook — fetches `/tenant/settings` once on app load; stores in context
- [ ] **WL-007** `TenantSettingsProvider.tsx` — context; injects `--brand-primary` CSS variable override on `<html>` when `primaryColor` is set
- [ ] **WL-008** `AppShell.tsx` — replace hardcoded "T" logo with `<img src={tenantSettings.logoUrl} />` if set; fallback to "T" monogram
- [ ] **WL-009** `index.html` — title and favicon updated dynamically via `document.title = tenantSettings.appName`
- [ ] **WL-010** Admin — `TenantBranding.tsx` page under Settings: logo upload (drag-and-drop), colour picker for primary colour (live preview), app name input, custom domain input
- [ ] **WL-011** Live preview panel: shows the sidebar + topbar with the selected branding before saving

#### Acceptance criteria
- Logo appears in sidebar within 1 second of page load
- Primary colour override immediately updates all brand-colour elements (buttons, active states, badges)
- Custom domain config is stored but actual DNS routing is out of scope for this sprint
- `npx tsc --noEmit` passes

---

## Sprint Delivery Order (Full Roadmap)

| # | Sprint | Status | Branch |
|---|--------|--------|--------|
| 1–12 | Foundation + CQRS + Core Features | ✅ DONE | merged to master |
| 13 | User Profile | ✅ DONE | merged |
| 14 | Bulk Submit | ✅ DONE | merged |
| 15 | Team Status | ✅ DONE | merged |
| 16 | Task Timer | ✅ DONE | merged |
| 17 | Project Budget Burn | ✅ DONE | merged |
| 18 | Entry Templates | ✅ DONE | merged |
| 19 | Leave Team Calendar | ✅ DONE | merged |
| 20 | Anomaly Alerts | ✅ DONE | merged |
| 21 | Saved Reports | ✅ DONE | merged |
| 22 | Approval Delegation | ✅ DONE | merged |
| 23 | Command Palette | ✅ DONE | merged |
| 24 | Mobile PWA | ✅ DONE | merged |
| 25 | Dark Mode | ✅ DONE | merged |
| 26 | UX Foundation (skeletons, toasts, empty states, error boundaries) | ✅ DONE | merged |
| **27** | **Multi-Timezone** | 🔴 **NEXT** | `feature/sprint-27-multi-timezone` |
| 28 | Onboarding Flow | TODO | `feature/sprint-28-onboarding` |
| 29 | Notification Centre 2.0 | TODO | `feature/sprint-29-notification-centre` |
| 30 | SignalR Real-time | TODO | `feature/sprint-30-signalr-realtime` |
| 31 | Billing & Subscription | TODO | `feature/sprint-31-billing` |
| 32 | SSO / SAML | TODO | `feature/sprint-32-sso` |
| 33 | Public API + Webhooks | TODO | `feature/sprint-33-public-api` |
| 34 | Overtime & Comp-off Rules | TODO | `feature/sprint-34-overtime-rules` |
| 35 | Slack / Teams Integration | TODO | `feature/sprint-35-slack-teams` |
| 36 | AI Smart Fill | TODO | `feature/sprint-36-ai-smart-fill` |
| 37 | Capacity Planning | TODO | `feature/sprint-37-capacity-planning` |
| 38 | GDPR / Compliance Toolkit | TODO | `feature/sprint-38-gdpr` |
| 39 | White-label & Theming | TODO | `feature/sprint-39-white-label` |

---

## Agent Quickstart Guide

Any AI agent picking up a sprint task should follow this sequence:

```
1. git checkout master && git pull origin master
2. git checkout -b feature/sprint-<N>-<slug>
3. Read this file for the sprint's full task list
4. Read relevant existing files before modifying them
5. Implement backend tasks first (entity → migration → controller)
6. Implement frontend tasks (hook → component → page → wire into App.tsx/AppShell)
7. Use existing patterns:
   - toast.success/error/warning/info via useToast()
   - useConfirm() for destructive actions
   - SkeletonPage for loading states
   - EmptyState presets for empty lists
   - ErrorBoundary already wraps all routes
8. cd apps/web && npx tsc --noEmit   ← must pass before commit
9. git add <specific files> && git commit -m "feat(sprint-N): ..."
10. git push origin feature/sprint-<N>-<slug>
```

### Key file locations
| What | Where |
|------|-------|
| Frontend entry | `apps/web/src/App.tsx` |
| Design tokens | `apps/web/src/styles/design-system.css` |
| Route views enum | `apps/web/src/types.ts` |
| AppShell nav items | `apps/web/src/components/AppShell.tsx` (NAV_ITEMS array) |
| API client | `apps/web/src/api/client.ts` |
| Toast hook | `apps/web/src/contexts/ToastContext.tsx` |
| Confirm hook | `apps/web/src/components/ConfirmDialog.tsx` |
| Skeleton components | `apps/web/src/components/Skeleton.tsx` |
| Empty states | `apps/web/src/components/EmptyState.tsx` |
| Backend controllers | `apps/api/Controllers/` |
| Domain entities | `src/TimeSheet.Domain/Entities/` |
| EF DbContext | `src/TimeSheet.Infrastructure/Persistence/TimeSheetDbContext.cs` |
| EF migrations dir | `src/TimeSheet.Infrastructure/Persistence/Migrations/` |
| EF migration cmd | `dotnet ef migrations add <Name> --project src/TimeSheet.Infrastructure --startup-project apps/api` |

### Adding a new page (standard pattern)
1. Add view key to `type View` in `apps/web/src/types.ts`
2. Add entry to `VIEW_PATHS` and `NAV_ITEMS` (with group: main/manager/admin) in `AppShell.tsx`
3. Add `<Route>` wrapped in `<ErrorBoundary>` in `App.tsx`
4. Create `apps/web/src/components/YourPage.tsx` with skeleton + empty state
5. Restrict access in `hasViewAccess()` in `App.tsx` if needed

---

## Initial Issue Creation Template
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
