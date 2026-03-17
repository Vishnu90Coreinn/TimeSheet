import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, toBadgeStatus } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the correct label for each status", () => {
    const cases: Array<{ status: Parameters<typeof StatusBadge>[0]["status"]; label: string }> = [
      { status: "missing",    label: "Missing" },
      { status: "draft",      label: "Draft" },
      { status: "submitted",  label: "Submitted" },
      { status: "approved",   label: "Approved" },
      { status: "rejected",   label: "Rejected" },
      { status: "pending",    label: "Pending" },
      { status: "on-leave",   label: "On Leave" },
      { status: "checkedIn",  label: "Checked In" },
      { status: "checkedOut", label: "Checked Out" },
      { status: "absent",     label: "Absent" },
    ];

    for (const { status, label } of cases) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeTruthy();
      unmount();
    }
  });

  it("includes an aria-label with the status value", () => {
    render(<StatusBadge status="approved" />);
    const el = screen.getByRole("status");
    expect(el.getAttribute("aria-label")).toBe("Status: Approved");
  });

  it("renders an icon alongside the text label (not color alone)", () => {
    const { container } = render(<StatusBadge status="missing" />);
    // icon is in an aria-hidden span sibling
    const iconSpan = container.querySelector("span[aria-hidden='true']");
    expect(iconSpan).toBeTruthy();
    expect(iconSpan!.textContent).not.toBe("");
  });

  it("accepts and merges custom style", () => {
    const { container } = render(<StatusBadge status="approved" style={{ fontSize: 20 }} />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.style.fontSize).toBe("20px");
  });
});

describe("toBadgeStatus", () => {
  it("maps raw API strings to BadgeStatus", () => {
    expect(toBadgeStatus("missing")).toBe("missing");
    expect(toBadgeStatus("submitted")).toBe("submitted");
    expect(toBadgeStatus("approved")).toBe("approved");
    expect(toBadgeStatus("rejected")).toBe("rejected");
    expect(toBadgeStatus("on-leave")).toBe("on-leave");
    expect(toBadgeStatus("checkedin")).toBe("checkedIn");
    expect(toBadgeStatus("checkedout")).toBe("checkedOut");
    expect(toBadgeStatus("absent")).toBe("absent");
  });

  it("is case-insensitive", () => {
    expect(toBadgeStatus("APPROVED")).toBe("approved");
    expect(toBadgeStatus("Missing")).toBe("missing");
  });

  it("falls back to 'draft' for unknown statuses", () => {
    expect(toBadgeStatus("unknown-status")).toBe("draft");
    expect(toBadgeStatus("")).toBe("draft");
  });
});
