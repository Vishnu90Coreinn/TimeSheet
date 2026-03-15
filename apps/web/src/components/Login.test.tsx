import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Login } from "./Login";

// Login.tsx uses global fetch directly (not apiFetch), so we mock global.fetch
vi.mock("../api/client", () => ({
  apiFetch: vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([]) }),
  setTokens: vi.fn(),
  setOnSessionExpired: vi.fn(),
  API_BASE: "http://localhost:5000/api/v1",
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Login", () => {
  it("renders username and password inputs", () => {
    render(<Login onLogin={vi.fn()} />);
    expect(screen.getByPlaceholderText(/admin or admin@timesheet/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/enter your password/i)).toBeTruthy();
  });

  it("calls fetch on submit", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accessToken: "tok", refreshToken: "rtok", role: "employee", username: "user", userId: "1" }),
    } as Response);

    render(<Login onLogin={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/admin or admin@timesheet/i), { target: { value: "user" } });
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/auth/login"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows error on failed login", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: "Invalid credentials" }),
    } as Response);

    render(<Login onLogin={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/admin or admin@timesheet/i), { target: { value: "user" } });
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeTruthy();
    });
  });

  it("calls onLogin callback on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accessToken: "tok", refreshToken: "rtok", role: "employee", username: "user", userId: "1" }),
    } as Response);

    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} />);

    fireEvent.change(screen.getByPlaceholderText(/admin or admin@timesheet/i), { target: { value: "user" } });
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: "tok", role: "employee", username: "user" }),
      );
    });
  });
});
