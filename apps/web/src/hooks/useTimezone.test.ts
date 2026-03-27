import { describe, expect, it } from "vitest";
import { normalizeTimeZoneId } from "./useTimezone";

describe("normalizeTimeZoneId", () => {
  it("maps legacy Windows timezone ids to browser-safe IANA ids", () => {
    expect(normalizeTimeZoneId("W. Australia Standard Time")).toBe("Australia/Perth");
    expect(normalizeTimeZoneId("India Standard Time")).toBe("Asia/Kolkata");
  });

  it("preserves valid IANA timezone ids", () => {
    expect(normalizeTimeZoneId("Australia/Perth")).toBe("Australia/Perth");
    expect(normalizeTimeZoneId("Asia/Kolkata")).toBe("Asia/Kolkata");
  });

  it("falls back to a valid timezone when the stored value is invalid", () => {
    const normalized = normalizeTimeZoneId("Not/A_Real_Timezone");
    expect(normalized).not.toBe("Not/A_Real_Timezone");
    expect(normalized.length).toBeGreaterThan(0);
  });
});
