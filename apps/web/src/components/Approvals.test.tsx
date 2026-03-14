import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Approvals } from "./Approvals";

// Mock the API client so no real fetches happen
vi.mock("../api/client", () => ({
  apiFetch: vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([]) }),
  setTokens: vi.fn(),
  setOnSessionExpired: vi.fn(),
  API_BASE: "http://localhost:5000/api/v1",
}));

describe("Approvals", () => {
  it("renders Approvals heading", () => {
    render(<Approvals />);
    // Approvals.tsx renders <h2>Timesheet Approvals</h2>
    expect(screen.getByText(/timesheet approvals/i)).toBeTruthy();
  });

  it("fetches pending approvals on mount", async () => {
    const { apiFetch } = await import("../api/client");
    render(<Approvals />);
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/approvals"),
      );
    });
  });

  it("renders empty state when no approvals", async () => {
    const { apiFetch } = await import("../api/client");
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response);

    render(<Approvals />);

    // Component should render without crashing; heading is always present
    await waitFor(() => {
      expect(screen.getByText(/timesheet approvals/i)).toBeTruthy();
    });
    // The pending list is empty — no approval rows rendered
    const listItems = screen.queryAllByRole("listitem");
    expect(listItems.length).toBe(0);
  });
});
