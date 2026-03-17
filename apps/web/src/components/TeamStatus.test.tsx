import { describe, expect, it } from "vitest";
import { buildSubtitle } from "./TeamStatus";

describe("buildSubtitle (Team Status dynamic subtitle)", () => {
  it("shows 'No direct reports assigned' when team is empty", () => {
    expect(buildSubtitle(0, 0, 0)).toBe("No direct reports assigned");
  });

  it("shows only member count when nothing is missing or pending", () => {
    expect(buildSubtitle(5, 0, 0)).toBe("5 members");
  });

  it("uses singular for 1 member", () => {
    expect(buildSubtitle(1, 0, 0)).toBe("1 member");
  });

  it("includes missing count when > 0", () => {
    expect(buildSubtitle(4, 2, 0)).toBe("4 members · 2 missing today");
  });

  it("includes needs-approval count when > 0", () => {
    expect(buildSubtitle(4, 0, 3)).toBe("4 members · 3 need approval");
  });

  it("uses singular 'needs' for 1 pending approval", () => {
    expect(buildSubtitle(4, 0, 1)).toBe("4 members · 1 needs approval");
  });

  it("includes both missing and needs-approval", () => {
    expect(buildSubtitle(6, 1, 2)).toBe("6 members · 1 missing today · 2 need approval");
  });
});
