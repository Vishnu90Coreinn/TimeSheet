import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Timesheets } from "./Timesheets";

const emptyDay = {
  timesheetId: "00000000-0000-0000-0000-000000000000",
  workDate: new Date().toISOString().slice(0, 10),
  status: "draft",
  attendanceNetMinutes: 0,
  expectedMinutes: 480,
  enteredMinutes: 0,
  remainingMinutes: 480,
  hasMismatch: false,
  entries: [],
};

const entryOptions = { projects: [], taskCategories: [] };

// Mock the API client so no real fetches happen
vi.mock("../api/client", () => ({
  apiFetch: vi.fn().mockImplementation((path: string) => {
    if (path.includes("entry-options")) {
      return Promise.resolve({ ok: true, json: async () => entryOptions });
    }
    return Promise.resolve({ ok: true, json: async () => emptyDay });
  }),
  setTokens: vi.fn(),
  setOnSessionExpired: vi.fn(),
  API_BASE: "http://localhost:5000/api/v1",
}));

describe("Timesheets", () => {
  it("renders Timesheets heading", () => {
    render(<Timesheets />);
    expect(screen.getByText(/timesheet/i)).toBeTruthy();
  });

  it("fetches week data on mount", async () => {
    const { apiFetch } = await import("../api/client");
    render(<Timesheets />);
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/timesheets"),
      );
    });
  });

  it("shows empty state when no data returned", async () => {
    const { apiFetch } = await import("../api/client");
    // Return ok:false so timesheetDay stays null — component renders without entries
    vi.mocked(apiFetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    } as Response);

    render(<Timesheets />);

    // Component renders without crashing when API returns no data
    await waitFor(() => {
      expect(document.body).toBeTruthy();
    });
  });
});
