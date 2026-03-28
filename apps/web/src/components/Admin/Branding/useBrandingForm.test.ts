import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useBrandingForm } from "./useBrandingForm";

const mockSettings = {
  appName: "Acme",
  primaryColor: "#6366f1",
  customDomain: "app.acme.com",
  logoUrl: "/uploads/logo.png",
  faviconUrl: null,
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockSettings),
  } as Response);
});

describe("useBrandingForm", () => {
  it("starts loading and then populates fields from API", async () => {
    const { result } = renderHook(() => useBrandingForm());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.form.appName).toBe("Acme");
    expect(result.current.form.primaryColor).toBe("#6366f1");
    expect(result.current.form.customDomain).toBe("app.acme.com");
    expect(result.current.form.currentLogoUrl).toBe("/uploads/logo.png");
  });

  it("isDirty is false after loading", async () => {
    const { result } = renderHook(() => useBrandingForm());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isDirty).toBe(false);
  });

  it("setField marks isDirty true", async () => {
    const { result } = renderHook(() => useBrandingForm());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setField("appName", "New Name"));
    expect(result.current.form.appName).toBe("New Name");
    expect(result.current.isDirty).toBe(true);
  });

  it("reset reverts fields and clears isDirty", async () => {
    const { result } = renderHook(() => useBrandingForm());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setField("appName", "New Name"));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.reset());
    expect(result.current.form.appName).toBe("Acme");
    expect(result.current.isDirty).toBe(false);
  });

  it("setLogoFile marks isDirty true", async () => {
    const { result } = renderHook(() => useBrandingForm());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const file = new File(["data"], "logo.png", { type: "image/png" });
    act(() => result.current.setLogoFile(file));
    expect(result.current.form.logoFile).toBe(file);
    expect(result.current.isDirty).toBe(true);
  });

  it("reset clears staged logoFile", async () => {
    const { result } = renderHook(() => useBrandingForm());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const file = new File(["data"], "logo.png", { type: "image/png" });
    act(() => result.current.setLogoFile(file));
    act(() => result.current.reset());
    expect(result.current.form.logoFile).toBeNull();
    expect(result.current.isDirty).toBe(false);
  });
});
