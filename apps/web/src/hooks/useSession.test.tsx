import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useSession } from "./useSession";

vi.mock("../api/client", () => ({
  apiFetch: vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) }),
  setTokens: vi.fn(),
  setOnSessionExpired: vi.fn(),
  API_BASE: "http://localhost:5000/api/v1",
}));

function SessionProbe() {
  const { session, loading, login, updateSession } = useSession();

  return (
    <div>
      <div data-testid="loading">{loading ? "loading" : "ready"}</div>
      <div data-testid="session">{JSON.stringify(session)}</div>
      <button
        type="button"
        onClick={() => login({
          userId: "1",
          accessToken: "access",
          refreshToken: "refresh",
          username: "employee",
          role: "employee",
          onboardingCompletedAt: null,
          leaveWorkflowVisitedAt: null,
        })}
      >
        login
      </button>
      <button
        type="button"
        onClick={() => updateSession({ onboardingCompletedAt: "2026-03-27T12:00:00.000Z" })}
      >
        complete
      </button>
      <button
        type="button"
        onClick={() => updateSession({ leaveWorkflowVisitedAt: "2026-03-27T12:30:00.000Z" })}
      >
        visit leave
      </button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("useSession", () => {
  it("hydrates onboarding completion from local storage", async () => {
    localStorage.setItem("accessToken", "access");
    localStorage.setItem("refreshToken", "refresh");
    localStorage.setItem("username", "employee");
    localStorage.setItem("role", "employee");
      localStorage.setItem("userId", "1");
      localStorage.setItem("onboardingCompletedAt", "2026-03-27T12:00:00.000Z");
      localStorage.setItem("leaveWorkflowVisitedAt", "2026-03-27T12:30:00.000Z");

    render(<SessionProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("ready");
      expect(screen.getByTestId("session").textContent).toContain("onboardingCompletedAt");
      expect(screen.getByTestId("session").textContent).toContain("leaveWorkflowVisitedAt");
    });
  });

  it("persists onboarding completion updates", async () => {
    localStorage.setItem("accessToken", "access");
    localStorage.setItem("refreshToken", "refresh");
    localStorage.setItem("username", "employee");
    localStorage.setItem("role", "employee");
    localStorage.setItem("userId", "1");

    render(<SessionProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("ready");
    });

    fireEvent.click(screen.getByRole("button", { name: "complete" }));

    await waitFor(() => {
      expect(localStorage.getItem("onboardingCompletedAt")).toBe("2026-03-27T12:00:00.000Z");
    });
  });

  it("persists leave workflow visits", async () => {
    localStorage.setItem("accessToken", "access");
    localStorage.setItem("refreshToken", "refresh");
    localStorage.setItem("username", "employee");
    localStorage.setItem("role", "employee");
    localStorage.setItem("userId", "1");

    render(<SessionProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("ready");
    });

    fireEvent.click(screen.getByRole("button", { name: "visit leave" }));

    await waitFor(() => {
      expect(localStorage.getItem("leaveWorkflowVisitedAt")).toBe("2026-03-27T12:30:00.000Z");
    });
  });
});
