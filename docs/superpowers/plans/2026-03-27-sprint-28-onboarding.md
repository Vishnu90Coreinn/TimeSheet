# Sprint 28 Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-login onboarding wizard and dashboard checklist that reduce time-to-value for employees and admins while preserving the existing Clean Architecture boundaries.

**Architecture:** Implement Sprint 28 as a new feature slice across Domain, Application, Infrastructure, API, and Web. Controllers must remain thin and call MediatR only. Checklist derivation logic belongs in Application contracts and Infrastructure query services, not in controllers or React components.

**Tech Stack:** ASP.NET Core 10, MediatR CQRS, EF Core, React 18, React Router 7, Vitest, existing `TimezoneSelect`, existing notification preference APIs, existing `useSession`.

---

## Branch

- [ ] Create and use a dedicated branch for this sprint:

```bash
git checkout master
git pull origin master
git checkout -b feature/sprint-28-onboarding
```

Note:
- Current local planning branch is `codex/feature/sprint-28-onboarding`.
- Before implementation begins for user testing, align to the product branch naming convention above.

---

## File Map

### Backend
- Modify: `src/TimeSheet.Domain/Entities/User.cs`
- Modify: `src/TimeSheet.Application/Auth/Queries/GetCurrentUserQuery.cs`
- Modify: `src/TimeSheet.Application/Auth/Queries/GetCurrentUserQueryHandler.cs`
- Create: `src/TimeSheet.Application/Onboarding/Commands/CompleteOnboardingCommand.cs`
- Create: `src/TimeSheet.Application/Onboarding/Commands/CompleteOnboardingCommandHandler.cs`
- Create: `src/TimeSheet.Application/Onboarding/Queries/GetOnboardingChecklistQuery.cs`
- Create: `src/TimeSheet.Application/Onboarding/Queries/GetOnboardingChecklistQueryHandler.cs`
- Create: `src/TimeSheet.Application/Onboarding/Queries/OnboardingChecklistResult.cs`
- Create: `src/TimeSheet.Application/Common/Interfaces/IOnboardingQueryService.cs`
- Create: `src/TimeSheet.Infrastructure/Services/OnboardingQueryService.cs`
- Modify: `src/TimeSheet.Infrastructure/DependencyInjection.cs`
- Modify: `src/TimeSheet.Infrastructure/Persistence/Configurations/UserConfiguration.cs`
- Create: `src/TimeSheet.Infrastructure/Persistence/Migrations/*Sprint28_Onboarding*.cs`
- Create: `apps/api/Controllers/OnboardingController.cs`
- Modify: `apps/api/Controllers/AuthController.cs`
- Modify: `apps/api/Dtos/AuthDtos.cs`

### Frontend
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/hooks/useSession.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`
- Create: `apps/web/src/components/OnboardingWizard.tsx`
- Create: `apps/web/src/components/OnboardingChecklist.tsx`

### Tests
- Create/modify: `src/TimeSheet.Integration.Tests/*Onboarding*Tests.cs`
- Create: `apps/web/src/components/OnboardingWizard.test.tsx`
- Create: `apps/web/src/components/OnboardingChecklist.test.tsx`
- Modify: `apps/web/src/App.test.tsx` or session-related tests if needed

---

## Recommended Design Decisions

- Use `onboardingCompletedAt` as part of the authenticated session payload so the app can decide immediately whether to show onboarding.
- Keep dismiss behavior simple: dismissing the wizard marks onboarding complete.
- Keep the dashboard checklist separate from wizard completion. The wizard is first-run guidance; the checklist is ongoing setup progress.
- Reuse existing timezone and notification-preference UI patterns rather than inventing new input systems.
- For admin users, show setup tasks oriented around tenant readiness. For employees, show self-service readiness tasks.

---

## Task 1: Add Onboarding State to the User Model

**Files:**
- Modify: `src/TimeSheet.Domain/Entities/User.cs`
- Modify: `src/TimeSheet.Infrastructure/Persistence/Configurations/UserConfiguration.cs`
- Create: `src/TimeSheet.Infrastructure/Persistence/Migrations/*Sprint28_Onboarding*.cs`

- [ ] Add nullable `OnboardingCompletedAt` to `User`.
- [ ] Update EF configuration so the column is optional and mapped consistently.
- [ ] Create the `Sprint28_Onboarding` migration.
- [ ] Verify the migration only adds the onboarding column and does not alter unrelated tables.

Run:
```bash
dotnet ef migrations add Sprint28_Onboarding --project src/TimeSheet.Infrastructure --startup-project apps/api
```

Expected:
- Migration adds nullable `OnboardingCompletedAt` to `Users`.

---

## Task 2: Extend the Auth Session Contract Cleanly

**Files:**
- Modify: `src/TimeSheet.Application/Auth/Queries/GetCurrentUserQuery.cs`
- Modify: `src/TimeSheet.Application/Auth/Queries/GetCurrentUserQueryHandler.cs`
- Modify: `apps/api/Controllers/AuthController.cs`
- Modify: `apps/api/Dtos/AuthDtos.cs`
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/hooks/useSession.ts`

- [ ] Add `OnboardingCompletedAt` to `CurrentUserResult`.
- [ ] Extend `GET /auth/me` response to include onboarding state.
- [ ] Extend login/refresh response DTOs if needed so first-login flows can show the wizard immediately after authentication.
- [ ] Update frontend `Session` typing and `useSession` hydration to store and restore onboarding state.
- [ ] Ensure session restoration still works on page refresh.

Acceptance check:
- Existing login still succeeds.
- Authenticated users now carry onboarding completion state in the frontend session.

---

## Task 3: Build Onboarding as an Application Feature Slice

**Files:**
- Create: `src/TimeSheet.Application/Onboarding/Commands/CompleteOnboardingCommand.cs`
- Create: `src/TimeSheet.Application/Onboarding/Commands/CompleteOnboardingCommandHandler.cs`
- Create: `src/TimeSheet.Application/Onboarding/Queries/GetOnboardingChecklistQuery.cs`
- Create: `src/TimeSheet.Application/Onboarding/Queries/GetOnboardingChecklistQueryHandler.cs`
- Create: `src/TimeSheet.Application/Onboarding/Queries/OnboardingChecklistResult.cs`
- Create: `src/TimeSheet.Application/Common/Interfaces/IOnboardingQueryService.cs`
- Create: `src/TimeSheet.Infrastructure/Services/OnboardingQueryService.cs`
- Modify: `src/TimeSheet.Infrastructure/DependencyInjection.cs`

- [ ] Create `CompleteOnboardingCommand` that stamps `OnboardingCompletedAt = UtcNow` for the current user.
- [ ] Create `GetOnboardingChecklistQuery` that returns checklist booleans derived from existing data.
- [ ] Put read-model derivation behind `IOnboardingQueryService` so the query handler stays thin and testable.
- [ ] Register the Infrastructure service in DI.

Checklist fields for first pass:
- `hasSubmittedTimesheet`
- `hasAppliedLeave`
- `hasSetTimezone`
- `hasSetNotificationPrefs`
- `adminHasProject`
- `adminHasLeavePolicy`
- `adminHasHoliday`
- `adminHasUser`

Important Clean Architecture note:
- Do not query `TimeSheetDbContext` directly from the controller.
- Do not place checklist business logic in the controller.

---

## Task 4: Add a Thin Onboarding API Controller

**Files:**
- Create: `apps/api/Controllers/OnboardingController.cs`

- [ ] Add `POST /api/v1/onboarding/complete` that sends `CompleteOnboardingCommand`.
- [ ] Add `GET /api/v1/onboarding/checklist` that sends `GetOnboardingChecklistQuery`.
- [ ] Keep the controller MediatR-only, matching the project’s Clean Architecture direction.

Acceptance check:
- Controller contains no direct EF code.
- Controller contains no business logic beyond request/response translation.

---

## Task 5: Add the Frontend Wizard

**Files:**
- Create: `apps/web/src/components/OnboardingWizard.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/hooks/useSession.ts`

- [ ] Show the wizard only when `session && !session.onboardingCompletedAt`.
- [ ] Step 1: Welcome with role-aware explanation.
- [ ] Step 2: Timezone using `TimezoneSelect`.
- [ ] Step 3: Notifications using the existing notification preference APIs.
- [ ] Final action marks onboarding complete through `/api/v1/onboarding/complete`.
- [ ] Dismiss action should also mark onboarding complete, per the roadmap.

UX notes:
- Keep the wizard modal focused and short.
- Reuse existing button and card tokens from the design system.
- Avoid blocking the entire app with unnecessary text; keep steps lightweight.

---

## Task 6: Add the Dashboard Checklist

**Files:**
- Create: `apps/web/src/components/OnboardingChecklist.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`

- [ ] Fetch `/api/v1/onboarding/checklist` for users who still need setup guidance.
- [ ] Show progress like `3/5 complete`.
- [ ] Link each checklist row to the relevant area:
  - timezone -> profile
  - notifications -> profile
  - timesheet -> timesheets
  - leave -> leave
  - admin setup tasks -> projects, leave policies, holidays, users
- [ ] Hide the checklist once all applicable tasks are complete.
- [ ] Keep it collapsible and unobtrusive on the dashboard.

---

## Task 7: Tests and Manual Verification

**Files:**
- Create/modify: `src/TimeSheet.Integration.Tests/*Onboarding*Tests.cs`
- Create: `apps/web/src/components/OnboardingWizard.test.tsx`
- Create: `apps/web/src/components/OnboardingChecklist.test.tsx`

- [ ] Add backend integration tests for:
  - onboarding complete endpoint
  - checklist response for employee
  - checklist response for admin
- [ ] Add frontend tests for:
  - wizard visible for incomplete session
  - wizard hidden for completed session
  - checklist renders correct actions by role
- [ ] Run web typecheck and focused tests.
- [ ] Run backend tests covering onboarding and auth/session payload changes.

Manual test checklist:
- Employee first login sees wizard.
- Dismiss wizard hides it on next load.
- Timezone step updates profile correctly.
- Notification step persists preferences.
- Employee dashboard checklist shows only employee tasks.
- Admin dashboard checklist shows org setup tasks.

---

## Suggested Commit Sequence

- [ ] `feat(sprint-28): add onboarding domain and session state`
- [ ] `feat(sprint-28): add onboarding api and checklist query`
- [ ] `feat(sprint-28): add onboarding wizard`
- [ ] `feat(sprint-28): add dashboard onboarding checklist`
- [ ] `test(sprint-28): cover onboarding flows`

---

## Verification Commands

Frontend:
```bash
cd apps/web
npm.cmd run lint
npm.cmd run test -- OnboardingWizard.test.tsx OnboardingChecklist.test.tsx
```

Backend:
```bash
dotnet test
```

Git:
```bash
git status
git add <specific files>
git commit -m "feat(sprint-28): ..."
git push origin feature/sprint-28-onboarding
```

---

## Exit Criteria

- New user sees onboarding on first login only.
- Wizard completion is persisted.
- Dashboard checklist is role-aware and collapsible.
- All new endpoints follow Clean Architecture and MediatR.
- Manual testing is completed before PR creation and merge.
