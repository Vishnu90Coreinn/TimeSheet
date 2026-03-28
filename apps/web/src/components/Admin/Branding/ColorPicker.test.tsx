import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPicker } from "./ColorPicker";

describe("ColorPicker", () => {
  it("renders the hex input with the given value", () => {
    render(<ColorPicker value="#6366f1" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("#6366f1") as HTMLInputElement;
    expect(input.value).toBe("#6366f1");
  });

  it("calls onChange with a valid hex when hex input changes", () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#6366f1" onChange={onChange} />);
    const input = screen.getByPlaceholderText("#6366f1");
    fireEvent.change(input, { target: { value: "#ff0000" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("#ff0000");
  });

  it("does not call onChange for an invalid hex on blur", () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#6366f1" onChange={onChange} />);
    const input = screen.getByPlaceholderText("#6366f1");
    fireEvent.change(input, { target: { value: "notahex" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows AAA ✓ badge for a high-contrast colour (#000000)", () => {
    render(<ColorPicker value="#000000" onChange={vi.fn()} />);
    // wcagContrastRatio("#000000") = 21.0:1, which is >= 7 so badge shows "AAA ✓"
    expect(screen.getByText("AAA ✓")).toBeTruthy();
  });

  it("shows Fail badge for a low-contrast colour (#ffffff)", () => {
    render(<ColorPicker value="#ffffff" onChange={vi.fn()} />);
    expect(screen.getByText("Fail")).toBeTruthy();
  });

  it("shows the correct WCAG badge for the default indigo (#6366f1)", () => {
    render(<ColorPicker value="#6366f1" onChange={vi.fn()} />);
    // wcagContrastRatio("#6366f1") ≈ 4.467, which is < 4.5 so badge shows "AA ✗"
    // (passes 3:1 threshold but not 4.5:1)
    expect(screen.getByText("AA ✗")).toBeTruthy();
  });
});
