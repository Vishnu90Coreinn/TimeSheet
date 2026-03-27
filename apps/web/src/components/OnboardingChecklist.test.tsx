import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingChecklist } from "./OnboardingChecklist";

const { apiFetch } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock("../api/client", () => ({
  apiFetch,
  setTokens: vi.fn(),
  setOnSessionExpired: vi.fn(),
  API_BASE: "http://localhost:5000/api/v1",
}));

describe("OnboardingChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders employee onboarding tasks from checklist data", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        hasSubmittedTimesheet: false,
        hasAppliedLeave: false,
        hasVisitedLeaveWorkflow: false,
        hasSetTimezone: true,
        hasSetNotificationPrefs: false,
        adminHasProject: true,
        adminHasLeavePolicy: true,
        adminHasHoliday: true,
        adminHasUser: true,
      }),
    } as Response);

    render(
      <MemoryRouter>
        <OnboardingChecklist role="employee" onboardingCompletedAt={null} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/getting started/i)).toBeTruthy();
      expect(screen.getByText("1/4 setup steps complete.")).toBeTruthy();
    });

    expect(screen.getByText(/submit your first timesheet/i)).toBeTruthy();
    expect(screen.getByText(/explore the leave workflow/i)).toBeTruthy();
    expect(screen.getByText(/choose notification defaults/i)).toBeTruthy();
  });

  it("marks the leave workflow item complete once it has been visited", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        hasSubmittedTimesheet: false,
        hasAppliedLeave: false,
        hasVisitedLeaveWorkflow: true,
        hasSetTimezone: false,
        hasSetNotificationPrefs: false,
        adminHasProject: true,
        adminHasLeavePolicy: true,
        adminHasHoliday: true,
        adminHasUser: true,
      }),
    } as Response);

    render(
      <MemoryRouter>
        <OnboardingChecklist role="employee" onboardingCompletedAt={null} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("1/4 setup steps complete.")).toBeTruthy();
    });

    expect(screen.queryByRole("button", { name: /open leave/i })).toBeNull();
    expect(screen.getByText(/explore the leave workflow/i)).toBeTruthy();
  });

  it("can collapse and expand the checklist panel", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        hasSubmittedTimesheet: false,
        hasAppliedLeave: false,
        hasSetTimezone: false,
        hasSetNotificationPrefs: false,
        adminHasProject: true,
        adminHasLeavePolicy: true,
        adminHasHoliday: true,
        adminHasUser: true,
      }),
    } as Response);

    render(
      <MemoryRouter>
        <OnboardingChecklist role="employee" onboardingCompletedAt="2026-03-27T12:00:00.000Z" />
      </MemoryRouter>,
    );

    await screen.findByText(/wizard completed/i);
    fireEvent.click(screen.getByRole("button", { name: /hide checklist/i }));
    expect(screen.queryByText(/submit your first timesheet/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /review setup/i }));
    expect(screen.getByText(/submit your first timesheet/i)).toBeTruthy();
  });

  it("hides itself when all applicable admin tasks are done", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        hasSubmittedTimesheet: true,
        hasAppliedLeave: true,
        hasSetTimezone: true,
        hasSetNotificationPrefs: true,
        adminHasProject: true,
        adminHasLeavePolicy: true,
        adminHasHoliday: true,
        adminHasUser: true,
      }),
    } as Response);

    render(
      <MemoryRouter>
        <OnboardingChecklist role="admin" onboardingCompletedAt="2026-03-27T12:00:00.000Z" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText(/getting started/i)).toBeNull();
    });
  });
});
