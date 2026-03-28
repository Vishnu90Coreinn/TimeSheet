import { describe, it, expect } from "vitest";
import {
  hexToHsv,
  hsvToHex,
  hexToHsl,
  hslToHex,
  buildScale,
  wcagContrastRatio,
} from "./colorUtils";

describe("hexToHsv", () => {
  it("converts pure red to HSV", () => {
    const [h, s, v] = hexToHsv("#ff0000");
    expect(h).toBeCloseTo(0, 0);
    expect(s).toBeCloseTo(1, 2);
    expect(v).toBeCloseTo(1, 2);
  });

  it("converts white to HSV", () => {
    const [h, s, v] = hexToHsv("#ffffff");
    expect(s).toBeCloseTo(0, 2);
    expect(v).toBeCloseTo(1, 2);
  });

  it("converts black to HSV", () => {
    const [h, s, v] = hexToHsv("#000000");
    expect(s).toBeCloseTo(0, 2);
    expect(v).toBeCloseTo(0, 2);
  });
});

describe("hsvToHex", () => {
  it("round-trips through hexToHsv", () => {
    const original = "#6366f1";
    const [h, s, v] = hexToHsv(original);
    expect(hsvToHex(h, s, v)).toBe(original);
  });

  it("produces pure red from (0,1,1)", () => {
    expect(hsvToHex(0, 1, 1)).toBe("#ff0000");
  });

  it("produces white from (0,0,1)", () => {
    expect(hsvToHex(0, 0, 1)).toBe("#ffffff");
  });

  it("produces black from (0,0,0)", () => {
    expect(hsvToHex(0, 0, 0)).toBe("#000000");
  });
});

describe("wcagContrastRatio", () => {
  it("returns ~21 for black on white", () => {
    expect(wcagContrastRatio("#000000")).toBeCloseTo(21, 0);
  });

  it("returns 1 for white on white", () => {
    expect(wcagContrastRatio("#ffffff")).toBeCloseTo(1, 0);
  });

  it("returns a value >= 4.4 for the default indigo #6366f1", () => {
    expect(wcagContrastRatio("#6366f1")).toBeGreaterThanOrEqual(4.4);
  });

  it("returns a value < 4.5 for a light yellow", () => {
    expect(wcagContrastRatio("#fbbf24")).toBeLessThan(4.5);
  });
});

describe("buildScale", () => {
  it("returns an object with 10 stops", () => {
    const scale = buildScale("#6366f1");
    expect(Object.keys(scale)).toHaveLength(10);
    expect(scale[500]).toBeDefined();
    expect(scale[50]).toBeDefined();
    expect(scale[900]).toBeDefined();
  });

  it("50-stop is lighter than 500-stop", () => {
    const scale = buildScale("#6366f1");
    const [, , l50] = hexToHsl(scale[50]);
    const [, , l500] = hexToHsl(scale[500]);
    expect(l50).toBeGreaterThan(l500);
  });
});
