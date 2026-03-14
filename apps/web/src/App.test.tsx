import { describe, expect, it } from "vitest";
import { canManageUsers, hasViewAccess } from "./App";

describe("role guards", () => {
  it("allows all roles to access dashboard", () => {
    expect(hasViewAccess("admin", "dashboard")).toBe(true);
    expect(hasViewAccess("manager", "dashboard")).toBe(true);
    expect(hasViewAccess("employee", "dashboard")).toBe(true);
  });

  it("restricts admin view to admin role only", () => {
    expect(hasViewAccess("admin", "admin")).toBe(true);
    expect(hasViewAccess("manager", "admin")).toBe(false);
    expect(hasViewAccess("employee", "admin")).toBe(false);
  });


  it("allows all roles to access reports", () => {
    expect(hasViewAccess("admin", "reports")).toBe(true);
    expect(hasViewAccess("manager", "reports")).toBe(true);
    expect(hasViewAccess("employee", "reports")).toBe(true);
  });

  it("restricts user management actions to admin role", () => {
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("manager")).toBe(false);
    expect(canManageUsers("employee")).toBe(false);
  });
});
