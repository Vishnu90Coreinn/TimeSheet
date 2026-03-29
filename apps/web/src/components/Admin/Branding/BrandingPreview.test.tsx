import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrandingPreview } from "./BrandingPreview";

const baseProps = {
  appName: "Acme",
  primaryColor: "#6366f1",
  logoPreviewUrl: null,
};

describe("BrandingPreview", () => {
  it("renders the Sidebar switcher button as active by default", () => {
    render(<BrandingPreview {...baseProps} />);
    expect(screen.getByRole("button", { name: /sidebar/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /dashboard/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /login/i })).toBeTruthy();
  });

  it("clicking Dashboard switches the preview screen", () => {
    render(<BrandingPreview {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /dashboard/i }));
    expect(screen.getByText(/good morning/i)).toBeTruthy();
  });

  it("clicking Login switches the preview screen", () => {
    render(<BrandingPreview {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /login/i }));
    expect(screen.getAllByText(/sign in/i).length).toBeGreaterThan(0);
  });

  it("shows app name in Sidebar screen", () => {
    render(<BrandingPreview {...baseProps} />);
    expect(screen.getByText("Acme")).toBeTruthy();
  });

  it("shows logo image when logoPreviewUrl is provided", () => {
    render(<BrandingPreview {...baseProps} logoPreviewUrl="http://example.com/logo.png" />);
    const img = screen.getByAltText("Acme");
    expect(img).toBeTruthy();
    expect((img as HTMLImageElement).src).toContain("logo.png");
  });
});
