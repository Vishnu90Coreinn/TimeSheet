import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotificationBell, groupNotifications, normalizeNotificationPayload } from "./Notifications";

const { apiFetchMock, confirmMock, navigateMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  confirmMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("../api/client", () => ({
  apiFetch: apiFetchMock,
  setTokens: vi.fn(),
  setOnSessionExpired: vi.fn(),
  API_BASE: "http://localhost:5000/api/v1",
}));

vi.mock("./ConfirmDialog", () => ({
  useConfirm: () => confirmMock,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("notification helpers", () => {
  it("normalizes legacy array and paged notification payloads", () => {
    const legacy = normalizeNotificationPayload([
      {
        id: "n-1",
        title: "Legacy",
        message: "Old shape",
        type: 1,
        isRead: false,
        createdAtUtc: "2026-03-28T09:00:00Z",
      },
    ]);

    expect(legacy).toEqual({
      items: [
        {
          id: "n-1",
          title: "Legacy",
          message: "Old shape",
          type: 1,
          isRead: false,
          createdAtUtc: "2026-03-28T09:00:00Z",
        },
      ],
      totalUnread: 1,
      hasMore: false,
    });

    const paged = normalizeNotificationPayload({
      items: legacy.items,
      totalUnread: 7,
      hasMore: true,
    });

    expect(paged.totalUnread).toBe(7);
    expect(paged.hasMore).toBe(true);
  });

  it("groups notifications into the four dashboard buckets", () => {
    const groups = groupNotifications(
      [
        { id: "today", title: "Today", message: "", type: 1, isRead: false, createdAtUtc: "2026-03-28T09:00:00Z" },
        { id: "yesterday", title: "Yesterday", message: "", type: 1, isRead: false, createdAtUtc: "2026-03-27T09:00:00Z" },
        { id: "week", title: "Week", message: "", type: 1, isRead: false, createdAtUtc: "2026-03-25T09:00:00Z" },
        { id: "older", title: "Older", message: "", type: 1, isRead: false, createdAtUtc: "2026-03-20T09:00:00Z" },
      ],
      new Date("2026-03-28T12:00:00Z"),
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Today",
      "Yesterday",
      "Earlier this week",
      "Older",
    ]);
  });
});

describe("NotificationBell", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    confirmMock.mockReset();
    navigateMock.mockReset();
    confirmMock.mockResolvedValue(true);
  });

  it("renders notifications, opens action links, and loads more items", async () => {
    apiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/notifications?page=1&pageSize=10") {
        return Promise.resolve(jsonResponse({
          items: [
            {
              id: "n-1",
              title: "Open timesheet",
              message: "Review the submitted entry",
              type: 1,
              isRead: false,
              createdAtUtc: "2026-03-28T09:00:00Z",
              actionUrl: "/timesheets/123",
            },
            {
              id: "n-2",
              title: "Policy update",
              message: "Leave policy changed",
              type: 2,
              isRead: false,
              createdAtUtc: "2026-03-27T09:00:00Z",
            },
            {
              id: "n-3",
              title: "Older note",
              message: "Historical update",
              type: 5,
              isRead: true,
              createdAtUtc: "2026-03-20T09:00:00Z",
            },
          ],
          totalUnread: 2,
          hasMore: true,
        }));
      }

      if (path === "/notifications?page=2&pageSize=10") {
        return Promise.resolve(jsonResponse({
          items: [
            {
              id: "n-4",
              title: "Archived note",
              message: "Loaded from the next page",
              type: 3,
              isRead: false,
              createdAtUtc: "2026-03-18T09:00:00Z",
            },
          ],
          totalUnread: 2,
          hasMore: false,
        }));
      }

      if (path === "/notifications/n-1/read" && init?.method === "PUT") {
        return Promise.resolve(jsonResponse({}, true, 204));
      }

      if (path === "/notifications/n-2/read" && init?.method === "PUT") {
        return Promise.resolve(jsonResponse({}, true, 204));
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Notifications \(2 unread\)/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /Notifications \(2 unread\)/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Notifications" })).toBeTruthy();
    });

    const openButton = await screen.findByRole("button", { name: /Open timesheet/i });
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/timesheets/123");
    });

    const policyRow = screen.getByText("Policy update").closest("article");
    expect(policyRow).toBeTruthy();
    fireEvent.click(within(policyRow as HTMLElement).getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Notifications \(1 unread\)/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /Load more notifications/i }));

    await waitFor(() => {
      expect(screen.getByText("Archived note")).toBeTruthy();
    });
  });

  it("marks all as read and clears notifications after confirmation", async () => {
    apiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/notifications?page=1&pageSize=10") {
        return Promise.resolve(jsonResponse({
          items: [
            {
              id: "n-1",
              title: "Reminder",
              message: "Submit your timesheet",
              type: 0,
              isRead: false,
              createdAtUtc: "2026-03-28T08:00:00Z",
            },
            {
              id: "n-2",
              title: "Alert",
              message: "Attendance anomaly detected",
              type: 5,
              isRead: false,
              createdAtUtc: "2026-03-27T08:00:00Z",
            },
          ],
          totalUnread: 2,
          hasMore: false,
        }));
      }

      if (path === "/notifications/mark-all-read" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({}, true, 204));
      }

      if (path === "/notifications" && init?.method === "DELETE") {
        return Promise.resolve(jsonResponse({}, true, 204));
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Notifications \(2 unread\)/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /Notifications \(2 unread\)/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Notifications" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /Mark all read/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /Clear all/i }));

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith({
        title: "Clear all notifications?",
        message: "This removes every notification from your list.",
        confirmLabel: "Clear all",
        cancelLabel: "Cancel",
        variant: "danger",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("No notifications")).toBeTruthy();
    });
  });
});
