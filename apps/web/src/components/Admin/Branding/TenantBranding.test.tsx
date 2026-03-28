import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TenantBranding } from "./TenantBranding";

vi.mock("../../../api/client", () => ({
  apiFetch: vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) }),
  API_BASE: "http://localhost:5000/api/v1",
}));
vi.mock("../../../contexts/ToastContext", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      appName: "TestApp",
      primaryColor: "#6366f1",
      customDomain: "",
      logoUrl: null,
      faviconUrl: null,
    }),
  } as Response);
});

describe("TenantBranding", () => {
  it("renders all 6 tab labels after loading", async () => {
    render(<TenantBranding />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).toBeFalsy());
    expect(screen.getByRole("button", { name: /identity/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /colors/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /assets/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /login/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /emails/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /advanced/i })).toBeTruthy();
  });

  it("shows Identity tab content by default", async () => {
    render(<TenantBranding />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).toBeFalsy());
    expect(screen.getByPlaceholderText("TimeSheet")).toBeTruthy();
  });

  it("switches to Colors tab when clicked", async () => {
    render(<TenantBranding />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).toBeFalsy());
    fireEvent.click(screen.getByRole("button", { name: /colors/i }));
    expect(screen.getByText(/brand presets/i)).toBeTruthy();
  });

  it("dirty banner appears when app name is changed", async () => {
    render(<TenantBranding />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).toBeFalsy());
    const input = screen.getByPlaceholderText("TimeSheet");
    fireEvent.change(input, { target: { value: "New Name" } });
    expect(screen.getByText(/you have unsaved changes/i)).toBeTruthy();
  });

  it("dirty banner disappears after Discard is clicked", async () => {
    render(<TenantBranding />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).toBeFalsy());
    const input = screen.getByPlaceholderText("TimeSheet");
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: /discard/i }));
    expect(screen.queryByText(/you have unsaved changes/i)).toBeFalsy();
  });
});
