import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttendanceWidget } from "./AttendanceWidget";

const checkedInSummary = {
  activeSessionId: "active-1",
  workDate: "2026-03-27",
  status: "checkedIn",
  lastCheckInAtUtc: "2026-03-27T16:16:00",
  lastCheckOutAtUtc: null,
  netMinutes: 32,
};

const todaySessions = [
  {
    id: "completed-1",
    checkInAtUtc: "2026-03-27T15:45:00",
    checkOutAtUtc: "2026-03-27T16:00:00",
    durationMinutes: 15,
  },
  {
    id: "active-1",
    checkInAtUtc: "2026-03-27T16:16:00",
    checkOutAtUtc: null,
    durationMinutes: null,
  },
];

vi.mock("../api/client", () => ({
  apiFetch: vi.fn().mockImplementation((path: string) => {
    if (path === "/attendance/summary/today") {
      return Promise.resolve({ ok: true, json: async () => checkedInSummary });
    }

    if (path === "/attendance/sessions/today") {
      return Promise.resolve({ ok: true, json: async () => todaySessions });
    }

    if (path === "/attendance/check-out") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ...checkedInSummary,
          activeSessionId: null,
          status: "checkedOut",
          lastCheckOutAtUtc: "2026-03-27T16:48:00",
          netMinutes: 47,
        }),
      });
    }

    return Promise.resolve({ ok: true, json: async () => ({}) });
  }),
  setTokens: vi.fn(),
  setOnSessionExpired: vi.fn(),
  API_BASE: "http://localhost:5000/api/v1",
}));

describe("AttendanceWidget", () => {
  it("shows a single primary action and keeps sessions collapsed by default", async () => {
    localStorage.setItem("timeZoneId", "Asia/Kolkata");
    render(<AttendanceWidget />);

    await waitFor(() => {
      expect(screen.getByText("Currently checked in")).toBeTruthy();
    });

    expect(screen.getByRole("button", { name: "Check out" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Check in now" })).toBeNull();
    expect(screen.getByRole("button", { name: /View today's sessions \(2\)/i })).toBeTruthy();
    expect(screen.queryByText(/03:45 PM -> 04:00 PM/i)).toBeNull();
  });

  it("expands session details on demand", async () => {
    localStorage.setItem("timeZoneId", "Asia/Kolkata");
    render(<AttendanceWidget />);

    const toggle = await screen.findByRole("button", { name: /View today's sessions \(2\)/i });
    fireEvent.click(toggle);

    expect(screen.getByText(/09:15 PM/)).toBeTruthy();
    expect(screen.getByText(/09:30 PM/)).toBeTruthy();
    expect(screen.getAllByText("Live").length).toBeGreaterThan(0);
  });
});
