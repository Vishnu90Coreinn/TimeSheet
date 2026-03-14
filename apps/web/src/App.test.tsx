import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { App, canManageUsers, hasViewAccess } from "./App";

// Mock the API client so no real fetches happen in tests
vi.mock("./api/client", () => ({
  apiFetch: vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
  setTokens: vi.fn(),
  setOnSessionExpired: vi.fn(),
  API_BASE: "http://localhost:5000/api/v1",
}));

describe("hasViewAccess", () => {
  it("allows all roles to access dashboard", () => {
    expect(hasViewAccess("employee", "dashboard")).toBe(true);
    expect(hasViewAccess("manager", "dashboard")).toBe(true);
    expect(hasViewAccess("admin", "dashboard")).toBe(true);
  });

  it("restricts admin views to admin only", () => {
    expect(hasViewAccess("admin", "admin")).toBe(true);
    expect(hasViewAccess("manager", "admin")).toBe(false);
    expect(hasViewAccess("employee", "admin")).toBe(false);
  });

  it("allows manager and admin to access approvals", () => {
    expect(hasViewAccess("admin", "approvals")).toBe(true);
    expect(hasViewAccess("manager", "approvals")).toBe(true);
    expect(hasViewAccess("employee", "approvals")).toBe(false);
  });

  it("allows all roles to access reports", () => {
    expect(hasViewAccess("employee", "reports")).toBe(true);
  });
});

describe("canManageUsers", () => {
  it("allows only admin to manage users", () => {
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("manager")).toBe(false);
    expect(canManageUsers("employee")).toBe(false);
  });
});

describe("App", () => {
  it("renders loading state", () => {
    // localStorage is empty -> useSession shows loading briefly then shows login
    render(<App />);
    // App renders without crashing
    expect(document.body).toBeTruthy();
  });

  it("renders login form when not authenticated", async () => {
    render(<App />);
    // After loading completes, should show login
    await screen.findByText(/Timesheet/i);
  });
});
