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
- [ ] **TSK-RBAC-005** Add test coverage for access control matrix.

### E1-F3 User and Hierarchy Management
- [x] **TSK-USER-001** Create User, Department, and WorkPolicy master schemas.
- [x] **TSK-USER-002** Implement user CRUD APIs with validation (unique email/employee ID).
- [x] **TSK-USER-003** Implement reporting manager mapping and retrieval APIs.
- [x] **TSK-USER-004** Build admin user management UI (list/search/filter/create/edit/activate/deactivate).
- [x] **TSK-USER-005** Enforce “inactive users cannot submit timesheets”.
- [x] **TSK-USER-006** Add audit logging for user admin actions.

---

## Epic E2 — Attendance and Break Tracking

### E2-F1 Work Sessions
- [ ] **TSK-ATT-001** Create WorkSession schema and status enums.
- [ ] **TSK-ATT-002** Implement check-in API with duplicate active session prevention.
- [ ] **TSK-ATT-003** Implement check-out API with validation.
- [ ] **TSK-ATT-004** Support multi-session day aggregation per policy.
- [ ] **TSK-ATT-005** Implement attendance exception flagging for missing checkout.
- [ ] **TSK-ATT-006** Build attendance widget/UI for daily status.
- [ ] **TSK-ATT-007** Build attendance history view with date range filters.
- [ ] **TSK-ATT-008** Add unit tests for check-in/out rules and exception cases.

### E2-F2 Break Management
- [ ] **TSK-BRK-001** Create BreakEntry schema.
- [ ] **TSK-BRK-002** Implement start break API (validate active session).
- [ ] **TSK-BRK-003** Implement end break API (calculate duration, prevent overlap).
- [ ] **TSK-BRK-004** Implement manual break edit API with policy restrictions.
- [ ] **TSK-BRK-005** Add break summary endpoints for dashboards/reports.
- [ ] **TSK-BRK-006** Add break controls in attendance UI.
- [ ] **TSK-BRK-007** Add tests for overlap and sequence validation rules.

### E2-F3 Attendance Calculation Engine
- [ ] **TSK-CALC-001** Implement gross/lunch/extra-break/net calculation service.
- [ ] **TSK-CALC-002** Apply fixed lunch deduction (45 mins) via configurable policy.
- [ ] **TSK-CALC-003** Handle low-gross-duration edge cases with configurable behavior.
- [ ] **TSK-CALC-004** Expose attendance summary DTO for frontend/reports.
- [ ] **TSK-CALC-005** Add deterministic tests for sample calculations (09:00–18:00, 09:00–21:00).

---

## Epic E3 — Project and Task Masters

### E3-F1 Project Master
- [x] **TSK-PRJ-001** Create Project schema with required fields and statuses.
- [ ] **TSK-PRJ-002** Implement project CRUD + archive APIs.
- [ ] **TSK-PRJ-003** Implement project-member assignment APIs.
- [ ] **TSK-PRJ-004** Enforce active project visibility in timesheet entry.
- [ ] **TSK-PRJ-005** Build admin project management UI.
- [ ] **TSK-PRJ-006** Add tests for date validations and archive behavior.

### E3-F2 Task Categories
- [x] **TSK-TASK-001** Create TaskCategory schema.
- [x] **TSK-TASK-002** Seed default task categories from FRS.
- [ ] **TSK-TASK-003** Implement category CRUD APIs.
- [ ] **TSK-TASK-004** Enforce active-only categories in timesheet forms.
- [ ] **TSK-TASK-005** Build admin task category UI.

---

## Epic E4 — Timesheet Management

### E4-F1 Daily Entry
- [ ] **TSK-TS-001** Create Timesheet and TimesheetEntry schemas.
- [ ] **TSK-TS-002** Implement create/update/delete draft entry APIs.
- [ ] **TSK-TS-003** Implement daily totals calculation endpoint.
- [ ] **TSK-TS-004** Implement no-future-date validation.
- [ ] **TSK-TS-005** Implement backdated edit window based on policy.
- [ ] **TSK-TS-006** Build daily timesheet UI with add/edit/delete rows.
- [ ] **TSK-TS-007** Display attendance summary and entered vs remaining minutes.

### E4-F2 Weekly View
- [ ] **TSK-TS-008** Implement weekly aggregation API.
- [ ] **TSK-TS-009** Build weekly grid UI with status per day.
- [ ] **TSK-TS-010** Add week navigation within allowed limits.
- [ ] **TSK-TS-011** Add optional copy previous day/week helper.

### E4-F3 Validation and Submission
- [ ] **TSK-TS-012** Implement attendance vs timesheet mismatch comparison service.
- [ ] **TSK-TS-013** Implement mismatch reason requirement when policy enabled.
- [ ] **TSK-TS-014** Implement draft → submitted transition API.
- [ ] **TSK-TS-015** Lock submitted records unless rejected/pushed back/unlocked.
- [ ] **TSK-TS-016** Implement resubmission flow and status transitions.
- [ ] **TSK-TS-017** Add validation and workflow tests for statuses.

---

## Epic E5 — Leave Management

### E5-F1 Leave Types and Requests
- [ ] **TSK-LV-001** Create LeaveType and LeaveRequest schemas.
- [ ] **TSK-LV-002** Implement leave type admin CRUD and seed data.
- [ ] **TSK-LV-003** Implement apply leave API (full-day/half-day).
- [ ] **TSK-LV-004** Prevent/flag overlapping leave requests.
- [ ] **TSK-LV-005** Build leave apply/history UI.

### E5-F2 Leave Approval and Work Expectation
- [ ] **TSK-LV-006** Implement manager leave approval/rejection API with comments.
- [ ] **TSK-LV-007** Reflect approved leave in expected-hours logic.
- [ ] **TSK-LV-008** Build manager leave approval list UI.
- [ ] **TSK-LV-009** Add tests for full-day and half-day expectation adjustment.

---

## Epic E6 — Approval Workflow

### E6-F1 Timesheet Approval Actions
- [ ] **TSK-APR-001** Create ApprovalAction schema for audit/history.
- [ ] **TSK-APR-002** Build manager pending timesheet list endpoint.
- [ ] **TSK-APR-003** Implement approve action API.
- [ ] **TSK-APR-004** Implement reject/push-back APIs with mandatory comments.
- [ ] **TSK-APR-005** Build manager approval UI with filters and summaries.
- [ ] **TSK-APR-006** Build approval history component for employee/manager views.
- [ ] **TSK-APR-007** Add transition and authorization tests.

---

## Epic E7 — Dashboards and Analytics

### E7-F1 Employee Dashboard
- [ ] **TSK-DSH-EMP-001** Build today attendance summary card.
- [ ] **TSK-DSH-EMP-002** Build timesheet status and pending actions card.
- [ ] **TSK-DSH-EMP-003** Build weekly hours and break summary widgets.
- [ ] **TSK-DSH-EMP-004** Build project-wise effort chart.
- [ ] **TSK-DSH-EMP-005** Build monthly compliance trend visualization.

### E7-F2 Manager Dashboard
- [ ] **TSK-DSH-MGR-001** Build team present/on-leave/not-checked-in widgets.
- [ ] **TSK-DSH-MGR-002** Build missing timesheets and pending approvals widgets.
- [ ] **TSK-DSH-MGR-003** Build attendance vs timesheet mismatch view.
- [ ] **TSK-DSH-MGR-004** Build team utilization summary.
- [ ] **TSK-DSH-MGR-005** Build team project contribution summary.

### E7-F3 Management Dashboard
- [ ] **TSK-DSH-MGMT-001** Build org effort by department/project visualizations.
- [ ] **TSK-DSH-MGMT-002** Build billable vs non-billable and consultant vs internal summaries.
- [ ] **TSK-DSH-MGMT-003** Build underutilized/overloaded indicators.
- [ ] **TSK-DSH-MGMT-004** Build compliance/missing timesheet/overtime trends.

---

## Epic E8 — Reports and Export

### E8-F1 Reports
- [ ] **TSK-RPT-001** Implement attendance summary report endpoint.
- [ ] **TSK-RPT-002** Implement timesheet summary report endpoint.
- [ ] **TSK-RPT-003** Implement project effort report endpoint.
- [ ] **TSK-RPT-004** Implement leave and utilization reports.
- [ ] **TSK-RPT-005** Implement common report filter framework.
- [ ] **TSK-RPT-006** Build reports UI (tabular, filterable, paginated).

### E8-F2 Export
- [ ] **TSK-RPT-007** Implement CSV export service.
- [ ] **TSK-RPT-008** Implement Excel export service.
- [ ] **TSK-RPT-009** Implement selective PDF export for summary reports.
- [ ] **TSK-RPT-010** Ensure exports respect filters and role-based scope.

---

## Epic E9 — Notifications and Reminders

### E9-F1 Notification Infrastructure
- [ ] **TSK-NTF-001** Create Notification schema and delivery status tracking.
- [ ] **TSK-NTF-002** Build notification generation service.
- [ ] **TSK-NTF-003** Implement in-app notification API and UI panel.

### E9-F2 Scheduled Reminders
- [ ] **TSK-NTF-004** Implement missing checkout reminder job.
- [ ] **TSK-NTF-005** Implement missing timesheet reminder job.
- [ ] **TSK-NTF-006** Implement pending approvals reminder job.
- [ ] **TSK-NTF-007** Implement leave/timesheet status change notifications.
- [ ] **TSK-NTF-008** Add configurable schedule and templates.

---

## Epic E10 — Audit and Compliance

### E10-F1 Audit Trail
- [ ] **TSK-AUD-001** Create AuditLog schema.
- [ ] **TSK-AUD-002** Add audit hooks for timesheet CRUD.
- [ ] **TSK-AUD-003** Add audit hooks for leave and approval actions.
- [ ] **TSK-AUD-004** Add audit hooks for admin/policy changes.
- [ ] **TSK-AUD-005** Build audit query APIs and admin audit UI.

### E10-F2 Compliance Views
- [ ] **TSK-AUD-006** Build missing timesheet compliance report.
- [ ] **TSK-AUD-007** Build late submission and approval SLA report.
- [ ] **TSK-AUD-008** Build attendance exception report.

---

## Epic E11 — Admin Configuration and Master Data

### E11-F1 Policy Configuration
- [ ] **TSK-ADM-001** Create WorkPolicy configuration entities.
- [ ] **TSK-ADM-002** Build admin UI for lunch deduction/backdate/mismatch rules.
- [ ] **TSK-ADM-003** Connect policy values to attendance/timesheet validators.

### E11-F2 Holiday and Calendar
- [ ] **TSK-ADM-004** Create Holiday schema and admin CRUD APIs.
- [ ] **TSK-ADM-005** Build holiday calendar UI.
- [ ] **TSK-ADM-006** Integrate holiday logic into expected-hours calculations.

---

## Epic E12 — Engineering Quality, Delivery, and DevOps

### E12-F1 Architecture and Code Quality
- [x] **TSK-ENG-001** Set up backend solution structure (API/Application/Domain/Infrastructure).
- [ ] **TSK-ENG-002** Set up frontend module structure (auth/dashboard/attendance/timesheet/etc.).
- [ ] **TSK-ENG-003** Add API versioning and standardized error response format.
- [ ] **TSK-ENG-004** Add request validation framework.
- [ ] **TSK-ENG-005** Add structured logging and correlation IDs.

### E12-F2 Database and Migration
- [ ] **TSK-DB-001** Create normalized SQL Server schema scripts/migrations.
- [ ] **TSK-DB-002** Add seed data for roles, statuses, leave types, task categories.
- [ ] **TSK-DB-003** Add database indexing for report-heavy queries.

### E12-F3 Testing
- [ ] **TSK-QA-001** Add unit tests for attendance/timesheet/leave business logic.
- [ ] **TSK-QA-002** Add API integration tests for critical flows.
- [ ] **TSK-QA-003** Add frontend component tests for forms and status flows.
- [ ] **TSK-QA-004** Add end-to-end smoke tests for key user journeys.

### E12-F4 Delivery and Operations
- [ ] **TSK-OPS-001** Add environment-based config management.
- [ ] **TSK-OPS-002** Add CI pipeline for build/test/lint.
- [ ] **TSK-OPS-003** Add deployment scripts/templates for backend/frontend/db.
- [ ] **TSK-OPS-004** Add health checks and readiness endpoints.
- [ ] **TSK-OPS-005** Document runbooks and rollback basics.

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
