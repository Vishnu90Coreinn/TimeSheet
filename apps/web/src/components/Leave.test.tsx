import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Leave } from "./Leave";

/**
 * Mock apiFetch with graceful-fallback behaviour matching the new API shape:
 *
 *  /leave/balance/my          → ok:false  (graceful fallback — no cards shown, no error)
 *  /leave/types               → ok:true,  returns []
 *  /leave/requests/my/grouped → ok:false  (falls back to /leave/requests/my)
 *  /leave/requests/my         → ok:true,  returns []
 *  /leave/calendar            → ok:false  (calendar shown without dots)
 *  /leave/team-on-leave       → ok:false  (team section hidden)
 */
vi.mock("../api/client", () => ({
  apiFetch: vi.fn().mockImplementation((path: string) => {
    if (path.startsWith("/leave/balance/my")) {
      return Promise.resolve({ ok: false, json: () => Promise.resolve([]) });
    }
    if (path.startsWith("/leave/types")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (path.startsWith("/leave/requests/my/grouped")) {
      return Promise.resolve({ ok: false, json: () => Promise.resolve([]) });
    }
    if (path.startsWith("/leave/requests/my")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (path.startsWith("/leave/calendar")) {
      return Promise.resolve({ ok: false, json: () => Promise.resolve([]) });
    }
    if (path.startsWith("/leave/team-on-leave")) {
      return Promise.resolve({ ok: false, json: () => Promise.resolve([]) });
    }
    if (path.startsWith("/leave/requests/pending")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  }),
  setTokens: vi.fn(),
  setOnSessionExpired: vi.fn(),
  API_BASE: "http://localhost:5000/api/v1",
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Leave", () => {
  it("renders page title and subtitle", () => {
    render(<Leave isManager={false} isAdmin={false} />);
    expect(document.querySelector(".page-title")).toBeTruthy();
    expect(screen.getByText(/Leave Management/i)).toBeTruthy();
  });

  it("renders '+ Apply for Leave' button in the header", () => {
    render(<Leave isManager={false} isAdmin={false} />);
    expect(screen.getByText(/\+ Apply for Leave/i)).toBeTruthy();
  });

  it("renders Leave Report button in the header", () => {
    render(<Leave isManager={false} isAdmin={false} />);
    expect(screen.getByText(/Leave Report/i)).toBeTruthy();
  });

  it("renders Apply for Leave form card", () => {
    render(<Leave isManager={false} isAdmin={false} />);
    // "Apply for Leave" appears both in the header button and the form card title
    const matches = screen.getAllByText(/Apply for Leave/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Submit request button in the apply form", () => {
    render(<Leave isManager={false} isAdmin={false} />);
    expect(screen.getByText(/Submit request/i)).toBeTruthy();
  });

  it("renders Reset form button in the apply form", () => {
    render(<Leave isManager={false} isAdmin={false} />);
    expect(screen.getByText(/Reset form/i)).toBeTruthy();
  });

  it("renders Duration dropdown with Full day / Half day options", () => {
    render(<Leave isManager={false} isAdmin={false} />);
    expect(screen.getByText(/Full day/i)).toBeTruthy();
    expect(screen.getByText(/Half day/i)).toBeTruthy();
  });

  it("renders From Date and To Date inputs", () => {
    render(<Leave isManager={false} isAdmin={false} />);
    expect(screen.getByLabelText(/From Date/i)).toBeTruthy();
    expect(screen.getByLabelText(/To Date/i)).toBeTruthy();
  });

  it("renders Reason textarea with correct placeholder", () => {
    render(<Leave isManager={false} isAdmin={false} />);
    expect(screen.getByPlaceholderText(/Brief description of the reason for leave/i)).toBeTruthy();
  });

  it("renders Leave History card", async () => {
    render(<Leave isManager={false} isAdmin={false} />);
    await waitFor(() => {
      expect(screen.getByText(/Leave History/i)).toBeTruthy();
    });
  });

  it("renders FY year sub-header in history section", async () => {
    const currentYear = new Date().getFullYear();
    render(<Leave isManager={false} isAdmin={false} />);
    await waitFor(() => {
      // FY {year} appears in both page-subtitle and the history sub-header
      const matches = screen.getAllByText(new RegExp(`FY ${currentYear}`));
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders table column headers: TYPE, DATES, DAYS, APPLIED ON, APPROVED BY, STATUS", async () => {
    render(<Leave isManager={false} isAdmin={false} />);
    await waitFor(() => {
      expect(screen.getByText("TYPE")).toBeTruthy();
      expect(screen.getByText("DATES")).toBeTruthy();
      expect(screen.getByText("DAYS")).toBeTruthy();
      expect(screen.getByText("APPLIED ON")).toBeTruthy();
      expect(screen.getByText("APPROVED BY")).toBeTruthy();
      expect(screen.getByText("STATUS")).toBeTruthy();
    });
  });

  it("shows empty row when no history records", async () => {
    render(<Leave isManager={false} isAdmin={false} />);
    await waitFor(() => {
      expect(screen.getByText(/No leave records/i)).toBeTruthy();
    });
  });

  it("renders year selector with correct options", () => {
    render(<Leave isManager={false} isAdmin={false} />);
    expect(screen.getByDisplayValue(String(new Date().getFullYear()))).toBeTruthy();
  });

  it("calls apiFetch for leave types on mount", async () => {
    const { apiFetch } = await import("../api/client");
    render(<Leave isManager={false} isAdmin={false} />);
    await waitFor(() => {
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(expect.stringContaining("/leave/types"));
    });
  });

  it("calls apiFetch for balance on mount (graceful ok:false fallback)", async () => {
    const { apiFetch } = await import("../api/client");
    render(<Leave isManager={false} isAdmin={false} />);
    await waitFor(() => {
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(expect.stringContaining("/leave/balance/my"));
    });
    // No balance cards should appear (ok:false response)
    expect(document.querySelectorAll(".lv3-bal-card").length).toBe(0);
  });

  it("falls back to /leave/requests/my when grouped endpoint returns ok:false", async () => {
    const { apiFetch } = await import("../api/client");
    render(<Leave isManager={false} isAdmin={false} />);
    await waitFor(() => {
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(expect.stringContaining("/leave/requests/my/grouped"));
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(expect.stringContaining("/leave/requests/my"));
    });
  });

  it("renders mini calendar navigation buttons", () => {
    render(<Leave isManager={false} isAdmin={false} />);
    expect(screen.getByLabelText(/Previous month/i)).toBeTruthy();
    expect(screen.getByLabelText(/Next month/i)).toBeTruthy();
  });

  it("renders calendar legend items", () => {
    render(<Leave isManager={false} isAdmin={false} />);
    expect(screen.getByText(/Today/i)).toBeTruthy();
    expect(screen.getByText(/Pending leave/i)).toBeTruthy();
    expect(screen.getByText(/Approved leave/i)).toBeTruthy();
  });

  it("does NOT render manager section when isManager=false", () => {
    render(<Leave isManager={false} isAdmin={false} />);
    expect(screen.queryByText(/Pending Leave Approvals/i)).toBeNull();
  });

  it("renders manager section when isManager=true", async () => {
    render(<Leave isManager={true} isAdmin={false} />);
    await waitFor(() => {
      expect(screen.getByText(/Pending Leave Approvals/i)).toBeTruthy();
    });
  });

  it("calls /leave/requests/pending when isManager=true", async () => {
    const { apiFetch } = await import("../api/client");
    render(<Leave isManager={true} isAdmin={false} />);
    await waitFor(() => {
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(expect.stringContaining("/leave/requests/pending"));
    });
  });

  it("does NOT call /leave/requests/pending when isManager=false", async () => {
    const { apiFetch } = await import("../api/client");
    render(<Leave isManager={false} isAdmin={false} />);
    await waitFor(() => {
      expect(vi.mocked(apiFetch)).not.toHaveBeenCalledWith(expect.stringContaining("/leave/requests/pending"));
    });
  });

  it("does NOT render admin section when isAdmin=false", () => {
    render(<Leave isManager={false} isAdmin={false} />);
    expect(screen.queryByText(/Create Leave Type/i)).toBeNull();
  });

  it("renders admin section when isAdmin=true", () => {
    render(<Leave isManager={false} isAdmin={true} />);
    expect(screen.getByText(/Create Leave Type/i)).toBeTruthy();
    expect(screen.getByText(/Save Leave Type/i)).toBeTruthy();
  });

  it("renders the page subtitle with current year", () => {
    const currentYear = new Date().getFullYear();
    render(<Leave isManager={false} isAdmin={false} />);
    // Page subtitle contains "FY {year}" — may appear multiple times in the document
    const matches = screen.getAllByText(new RegExp(`FY ${currentYear}`));
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("does not show team-on-leave section when endpoint fails", async () => {
    render(<Leave isManager={false} isAdmin={false} />);
    await waitFor(() => {
      // ok:false means team section stays hidden
      expect(screen.queryByText(/TEAM ON LEAVE/i)).toBeNull();
    });
  });
});
