import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { OnboardingWizard } from "./OnboardingWizard";

const { apiFetch } = vi.hoisted(() => ({
  apiFetch: vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/profile" && (!init || init.method === undefined)) {
      return {
        ok: true,
        json: async () => ({
          username: "employee",
          displayName: "Employee",
          email: "employee@example.com",
          timeZoneId: "UTC",
        }),
      } as Response;
    }

    if (path === "/timezones") {
      return {
        ok: true,
        json: async () => ([
          { id: "UTC", displayName: "UTC" },
          { id: "Australia/Perth", displayName: "Australia Western Time" },
        ]),
      } as Response;
    }

    if (path === "/profile/notification-preferences" && (!init || init.method === undefined)) {
      return {
        ok: true,
        json: async () => ({
          onApproval: true,
          onRejection: true,
          onLeaveStatus: true,
          onReminder: false,
          inAppEnabled: true,
          emailEnabled: false,
        }),
      } as Response;
    }

    return {
      ok: true,
      json: async () => ({}),
    } as Response;
  }),
}));

vi.mock("../api/client", () => ({
  apiFetch,
  setTokens: vi.fn(),
  setOnSessionExpired: vi.fn(),
  API_BASE: "http://localhost:5000/api/v1",
}));

vi.mock("../contexts/ToastContext", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    toast: vi.fn(),
    dismiss: vi.fn(),
    toasts: [],
  }),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("OnboardingWizard", () => {
  it("walks through setup and marks onboarding complete", async () => {
    const onComplete = vi.fn();

    render(<OnboardingWizard open role="employee" username="employee" onComplete={onComplete} />);

    await screen.findByText(/welcome, employee/i);

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => {
      expect(screen.getByText(/choose your timezone/i)).toBeTruthy();
    });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Australia/Perth" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/notification preferences/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => {
      expect(screen.getByText(/review your setup/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /finish setup/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/profile",
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining("Australia/Perth"),
        }),
      );
      expect(apiFetch).toHaveBeenCalledWith(
        "/profile/notification-preferences",
        expect.objectContaining({ method: "PUT" }),
      );
      expect(apiFetch).toHaveBeenCalledWith("/onboarding/complete", { method: "POST" });
      expect(onComplete).toHaveBeenCalledWith(expect.any(String));
    });
  });
});
