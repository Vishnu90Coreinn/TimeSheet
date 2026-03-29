# Sprint 40 — Branding Page UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the flat Branding admin page into a professional 6-tab settings page with a custom colour picker, drag-and-drop asset uploads, a live multi-screen preview panel, brand colour presets, and an unsaved-changes banner.

**Architecture:** A new `components/Admin/Branding/` folder replaces the existing single-file `TenantBranding.tsx`. A `useBrandingForm` hook owns all form state and dirty tracking. `BrandingPreview` receives live form state as props and renders three mock screens (Sidebar, Dashboard, Login) using inline styles — it never mutates real CSS variables. No backend schema changes are required.

**Tech Stack:** React 18, TypeScript, Tailwind v4, Vitest + @testing-library/react (jsdom)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/utils/colorUtils.ts` | hexToHsv, hsvToHex, hexToHsl, hslToHex, buildScale, wcagContrastRatio |
| Create | `apps/web/src/utils/colorUtils.test.ts` | Unit tests for all colour utilities |
| Create | `apps/web/src/components/Admin/Branding/useBrandingForm.ts` | All form state, dirty flag, load/save/reset |
| Create | `apps/web/src/components/Admin/Branding/useBrandingForm.test.ts` | Hook unit tests |
| Create | `apps/web/src/components/Admin/Branding/ColorPicker.tsx` | Sat square + hue strip + hex input + WCAG badge |
| Create | `apps/web/src/components/Admin/Branding/ColorPicker.test.tsx` | Hex input + WCAG rendering tests |
| Create | `apps/web/src/components/Admin/Branding/BrandingPreview.tsx` | Screen switcher + 3 mock screens |
| Create | `apps/web/src/components/Admin/Branding/BrandingPreview.test.tsx` | Screen switcher tests |
| Create | `apps/web/src/components/Admin/Branding/tabs/IdentityTab.tsx` | App Name field |
| Create | `apps/web/src/components/Admin/Branding/tabs/ColorsTab.tsx` | ColorPicker + 6 brand preset cards |
| Create | `apps/web/src/components/Admin/Branding/tabs/AssetsTab.tsx` | Drag-and-drop logo + favicon upload |
| Create | `apps/web/src/components/Admin/Branding/tabs/LoginTab.tsx` | Coming-soon placeholder |
| Create | `apps/web/src/components/Admin/Branding/tabs/EmailsTab.tsx` | Coming-soon placeholder |
| Create | `apps/web/src/components/Admin/Branding/tabs/AdvancedTab.tsx` | Custom Domain + locked CSS/JSON stubs |
| Create | `apps/web/src/components/Admin/Branding/TenantBranding.tsx` | Page shell: tab bar, header, dirty banner |
| Create | `apps/web/src/components/Admin/Branding/TenantBranding.test.tsx` | Tab switching + dirty banner tests |
| Update | `apps/web/src/contexts/TenantSettingsContext.tsx` | Import colour utils from colorUtils.ts |
| Update | `apps/web/src/App.tsx` | Update import path for TenantBranding |
| Delete | `apps/web/src/components/Admin/TenantBranding.tsx` | Replaced by Branding/ folder |

---

## Task 1: Extract colour utilities to `colorUtils.ts`

**Files:**
- Create: `apps/web/src/utils/colorUtils.ts`
- Create: `apps/web/src/utils/colorUtils.test.ts`
- Modify: `apps/web/src/contexts/TenantSettingsContext.tsx`

- [ ] **Step 1.1: Write failing tests for colour utilities**

Create `apps/web/src/utils/colorUtils.test.ts`:

```typescript
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

  it("returns a value >= 4.5 for the default indigo #6366f1", () => {
    // Indigo passes AA for white text
    expect(wcagContrastRatio("#6366f1")).toBeGreaterThanOrEqual(4.5);
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
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run src/utils/colorUtils.test.ts 2>&1
```
Expected: FAIL — `colorUtils.ts` does not exist yet.

- [ ] **Step 1.3: Create `colorUtils.ts`**

Create `apps/web/src/utils/colorUtils.ts`:

```typescript
/** Colour math utilities shared by ColorPicker and TenantSettingsContext. */

// ─── HSV ↔ Hex ───────────────────────────────────────────────────────────────

/** Converts a 6-digit hex colour (#rrggbb) to [h°(0-360), s(0-1), v(0-1)]. */
export function hexToHsv(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [h, s, v];
}

/** Converts [h°(0-360), s(0-1), v(0-1)] to a 6-digit hex colour. */
export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) {         g = c; b = x; }
  else if (h < 240) {         g = x; b = c; }
  else if (h < 300) { r = x;         b = c; }
  else              { r = c;         b = x; }
  const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, (n + m) * 255))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ─── HSL ↔ Hex ───────────────────────────────────────────────────────────────

/** Converts a hex colour to [h(0-1), s(0-1), l(0-1)]. */
export function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

/** Converts [h(0-1), s(0-1), l(0-1)] to a 6-digit hex colour. */
export function hslToHex(h: number, s: number, l: number): string {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  l = clamp(l); s = clamp(s);
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(clamp(color) * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Generates a 9-stop HSL colour scale (50–900) from a single hex-500 anchor. */
export function buildScale(hex: string): Record<number, string> {
  const [h, s, l] = hexToHsl(hex);
  const stops: [number, number][] = [
    [50,  0.97], [100, 0.93], [200, 0.86], [300, 0.76], [400, 0.63],
    [500, l],
    [600, l * 0.85], [700, l * 0.70], [800, l * 0.55], [900, l * 0.42],
  ];
  return Object.fromEntries(stops.map(([stop, lightness]) => [stop, hslToHex(h, s, lightness)]));
}

// ─── WCAG ─────────────────────────────────────────────────────────────────────

/** Returns the WCAG 2.1 contrast ratio between the given colour and white (#ffffff). */
export function wcagContrastRatio(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  const Lwhite = 1;
  return (Lwhite + 0.05) / (L + 0.05);
}

/** Applies a full brand colour scale from a single hex-500 value to :root CSS variables. */
export function applyBrandColor(hex500: string) {
  const root = document.documentElement;
  const scale = buildScale(hex500);
  for (const [stop, value] of Object.entries(scale)) {
    root.style.setProperty(`--brand-${stop}`, value);
    root.style.setProperty(`--color-brand-${stop}`, value);
  }
  root.style.setProperty("--color-primary",        scale[600]);
  root.style.setProperty("--color-primary-hover",  scale[700]);
  root.style.setProperty("--color-primary-light",  scale[300]);
  root.style.setProperty("--color-primary-subtle", scale[50]);
  root.style.setProperty("--color-border-focus",   scale[500]);
  root.style.setProperty("--text-brand",           scale[700]);
  root.style.setProperty("--border-brand",         scale[400]);
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run src/utils/colorUtils.test.ts 2>&1
```
Expected: All tests PASS.

- [ ] **Step 1.5: Update `TenantSettingsContext.tsx` to import from colorUtils**

Replace the inline colour utility functions in `TenantSettingsContext.tsx` with imports from `colorUtils.ts`. The file currently defines `hexToHsl`, `hslToHex`, `buildScale`, and `applyBrandColor` inline. Replace the entire file body so it imports from `colorUtils`:

Open `apps/web/src/contexts/TenantSettingsContext.tsx` and replace the section from the `applyBrandColor` function definition through the end of the file (`hslToHex` at the bottom) with:

```typescript
export { applyBrandColor } from "../utils/colorUtils";
```

The final file should be:

```typescript
import { createContext, useContext, useEffect, useState } from "react";
export { applyBrandColor } from "../utils/colorUtils";
import { applyBrandColor } from "../utils/colorUtils";

export interface TenantSettings {
  appName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  customDomain: string | null;
}

const defaults: TenantSettings = {
  appName: "TimeSheet",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  customDomain: null,
};

const TenantSettingsContext = createContext<TenantSettings>(defaults);

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5000/api/v1";

export function TenantSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<TenantSettings>(defaults);

  useEffect(() => {
    fetch(`${API_BASE}/tenant/settings`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: TenantSettings | null) => {
        if (!data) return;
        setSettings(data);
        if (data.primaryColor) applyBrandColor(data.primaryColor);
        if (data.appName) document.title = data.appName;
        if (data.faviconUrl) {
          let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
          if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
          link.href = `http://localhost:5000${data.faviconUrl}`;
        }
      })
      .catch(() => {});
  }, []);

  return (
    <TenantSettingsContext.Provider value={settings}>
      {children}
    </TenantSettingsContext.Provider>
  );
}

export function useTenantSettings() {
  return useContext(TenantSettingsContext);
}
```

- [ ] **Step 1.6: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```
Expected: Zero errors.

- [ ] **Step 1.7: Commit**

```bash
cd apps/web && git add src/utils/colorUtils.ts src/utils/colorUtils.test.ts src/contexts/TenantSettingsContext.tsx
git commit -m "refactor: extract colour utilities to colorUtils.ts"
```

---

## Task 2: `useBrandingForm` hook

**Files:**
- Create: `apps/web/src/components/Admin/Branding/useBrandingForm.ts`
- Create: `apps/web/src/components/Admin/Branding/useBrandingForm.test.ts`

- [ ] **Step 2.1: Write failing tests**

Create `apps/web/src/components/Admin/Branding/useBrandingForm.test.ts`:

```typescript
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
```

- [ ] **Step 2.2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run src/components/Admin/Branding/useBrandingForm.test.ts 2>&1
```
Expected: FAIL — module not found.

- [ ] **Step 2.3: Create `useBrandingForm.ts`**

Create `apps/web/src/components/Admin/Branding/useBrandingForm.ts`:

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import { applyBrandColor } from "../../../utils/colorUtils";
import { API_BASE } from "../../../api/client";

export interface BrandingFormState {
  appName: string;
  primaryColor: string;
  customDomain: string;
  logoFile: File | null;
  faviconFile: File | null;
  currentLogoUrl: string | null;
  currentFaviconUrl: string | null;
}

interface SavedSnapshot {
  appName: string;
  primaryColor: string;
  customDomain: string;
  currentLogoUrl: string | null;
  currentFaviconUrl: string | null;
}

const DEFAULTS: BrandingFormState = {
  appName: "TimeSheet",
  primaryColor: "#6366f1",
  customDomain: "",
  logoFile: null,
  faviconFile: null,
  currentLogoUrl: null,
  currentFaviconUrl: null,
};

export function useBrandingForm() {
  const [form, setForm] = useState<BrandingFormState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const snapshot = useRef<SavedSnapshot>({
    appName: DEFAULTS.appName,
    primaryColor: DEFAULTS.primaryColor,
    customDomain: DEFAULTS.customDomain,
    currentLogoUrl: null,
    currentFaviconUrl: null,
  });

  useEffect(() => {
    fetch(`${API_BASE}/tenant/settings`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: { appName: string; primaryColor: string | null; customDomain: string | null; logoUrl: string | null; faviconUrl: string | null } | null) => {
        if (!data) return;
        const loaded: BrandingFormState = {
          appName: data.appName ?? "TimeSheet",
          primaryColor: data.primaryColor ?? "#6366f1",
          customDomain: data.customDomain ?? "",
          logoFile: null,
          faviconFile: null,
          currentLogoUrl: data.logoUrl ?? null,
          currentFaviconUrl: data.faviconUrl ?? null,
        };
        setForm(loaded);
        snapshot.current = {
          appName: loaded.appName,
          primaryColor: loaded.primaryColor,
          customDomain: loaded.customDomain,
          currentLogoUrl: loaded.currentLogoUrl,
          currentFaviconUrl: loaded.currentFaviconUrl,
        };
      })
      .finally(() => setLoading(false));
  }, []);

  const isDirty =
    form.appName !== snapshot.current.appName ||
    form.primaryColor !== snapshot.current.primaryColor ||
    form.customDomain !== snapshot.current.customDomain ||
    form.logoFile !== null ||
    form.faviconFile !== null;

  const setField = useCallback(<K extends keyof Pick<BrandingFormState, "appName" | "primaryColor" | "customDomain">>(
    key: K,
    value: string,
  ) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  const setLogoFile = useCallback((file: File | null) => {
    setForm(f => ({ ...f, logoFile: file }));
  }, []);

  const setFaviconFile = useCallback((file: File | null) => {
    setForm(f => ({ ...f, faviconFile: file }));
  }, []);

  const setCurrentLogoUrl = useCallback((url: string | null) => {
    setForm(f => ({ ...f, currentLogoUrl: url }));
    snapshot.current = { ...snapshot.current, currentLogoUrl: url };
  }, []);

  const setCurrentFaviconUrl = useCallback((url: string | null) => {
    setForm(f => ({ ...f, currentFaviconUrl: url }));
    snapshot.current = { ...snapshot.current, currentFaviconUrl: url };
  }, []);

  const reset = useCallback(() => {
    setForm(f => ({
      ...f,
      appName: snapshot.current.appName,
      primaryColor: snapshot.current.primaryColor,
      customDomain: snapshot.current.customDomain,
      logoFile: null,
      faviconFile: null,
    }));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const token = localStorage.getItem("accessToken");
      const formData = new FormData();
      formData.append("appName", form.appName);
      formData.append("primaryColor", form.primaryColor);
      formData.append("customDomain", form.customDomain);
      if (form.logoFile) formData.append("logo", form.logoFile);
      if (form.faviconFile) formData.append("favicon", form.faviconFile);

      const response = await fetch(`${API_BASE}/tenant/settings`, {
        method: "PUT",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) return false;

      const data: { appName: string; primaryColor: string | null; customDomain: string | null; logoUrl: string | null; faviconUrl: string | null } = await response.json();

      const newSnapshot: SavedSnapshot = {
        appName: data.appName,
        primaryColor: data.primaryColor ?? "#6366f1",
        customDomain: data.customDomain ?? "",
        currentLogoUrl: data.logoUrl ?? null,
        currentFaviconUrl: data.faviconUrl ?? null,
      };
      snapshot.current = newSnapshot;

      setForm(f => ({
        ...f,
        appName: newSnapshot.appName,
        primaryColor: newSnapshot.primaryColor,
        customDomain: newSnapshot.customDomain,
        logoFile: null,
        faviconFile: null,
        currentLogoUrl: newSnapshot.currentLogoUrl,
        currentFaviconUrl: newSnapshot.currentFaviconUrl,
      }));

      applyBrandColor(newSnapshot.primaryColor);
      document.title = newSnapshot.appName;
      return true;
    } finally {
      setSaving(false);
    }
  }, [form]);

  return {
    form,
    loading,
    saving,
    isDirty,
    setField,
    setLogoFile,
    setFaviconFile,
    setCurrentLogoUrl,
    setCurrentFaviconUrl,
    reset,
    save,
  };
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run src/components/Admin/Branding/useBrandingForm.test.ts 2>&1
```
Expected: All tests PASS.

- [ ] **Step 2.5: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```
Expected: Zero errors.

- [ ] **Step 2.6: Commit**

```bash
git add apps/web/src/components/Admin/Branding/useBrandingForm.ts apps/web/src/components/Admin/Branding/useBrandingForm.test.ts
git commit -m "feat(branding): useBrandingForm hook with dirty tracking"
```

---

## Task 3: `ColorPicker` component

**Files:**
- Create: `apps/web/src/components/Admin/Branding/ColorPicker.tsx`
- Create: `apps/web/src/components/Admin/Branding/ColorPicker.test.tsx`

- [ ] **Step 3.1: Write failing tests**

Create `apps/web/src/components/Admin/Branding/ColorPicker.test.tsx`:

```typescript
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

  it("shows AA ✓ badge for a high-contrast colour (#000000)", () => {
    render(<ColorPicker value="#000000" onChange={vi.fn()} />);
    expect(screen.getByText("AA ✓")).toBeTruthy();
  });

  it("shows Fail badge for a low-contrast colour (#ffffff)", () => {
    render(<ColorPicker value="#ffffff" onChange={vi.fn()} />);
    expect(screen.getByText("Fail")).toBeTruthy();
  });

  it("shows AA ✓ badge for the default indigo", () => {
    render(<ColorPicker value="#6366f1" onChange={vi.fn()} />);
    expect(screen.getByText("AA ✓")).toBeTruthy();
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run src/components/Admin/Branding/ColorPicker.test.tsx 2>&1
```
Expected: FAIL — module not found.

- [ ] **Step 3.3: Create `ColorPicker.tsx`**

Create `apps/web/src/components/Admin/Branding/ColorPicker.tsx`:

```tsx
/**
 * ColorPicker.tsx — Saturation/brightness square + hue strip + hex input + WCAG badge.
 * No external library — all colour math is in colorUtils.ts.
 */
import { useEffect, useRef, useState } from "react";
import { hexToHsv, hsvToHex, wcagContrastRatio } from "../../../utils/colorUtils";

interface ColorPickerProps {
  value: string;   // 6-digit hex, e.g. "#6366f1"
  onChange: (hex: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(value));
  const [hexInput, setHexInput] = useState(value);
  // Ref keeps HSV current for synchronous pointer-move handlers
  const hsvRef = useRef(hsv);

  // Sync when the controlled value changes externally (e.g. preset click)
  useEffect(() => {
    const current = hsvToHex(...hsvRef.current);
    if (value !== current) {
      const next = hexToHsv(value);
      hsvRef.current = next;
      setHsv(next);
      setHexInput(value);
    }
  }, [value]);

  // Keep hsvRef in sync with state
  useEffect(() => { hsvRef.current = hsv; }, [hsv]);

  const squareRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  function updateFromSquare(e: React.PointerEvent) {
    const rect = squareRef.current!.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const next: [number, number, number] = [hsvRef.current[0], s, v];
    hsvRef.current = next;
    setHsv(next);
    const hex = hsvToHex(...next);
    setHexInput(hex);
    onChange(hex);
  }

  function updateFromHue(e: React.PointerEvent) {
    const rect = hueRef.current!.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
    const next: [number, number, number] = [h, hsvRef.current[1], hsvRef.current[2]];
    hsvRef.current = next;
    setHsv(next);
    const hex = hsvToHex(...next);
    setHexInput(hex);
    onChange(hex);
  }

  const hueColour = hsvToHex(hsv[0], 1, 1);
  const contrast = wcagContrastRatio(value);
  const wcagLabel = contrast >= 7 ? "AAA ✓" : contrast >= 4.5 ? "AA ✓" : contrast >= 3 ? "AA ✗" : "Fail";
  const wcagBg = contrast >= 4.5
    ? "bg-green-100 text-green-800 border border-green-200"
    : contrast >= 3
    ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
    : "bg-red-100 text-red-800 border border-red-200";
  const wcagExplain = contrast >= 4.5
    ? `Contrast ${contrast.toFixed(1)}:1 — passes WCAG AA for white text`
    : contrast >= 3
    ? `Contrast ${contrast.toFixed(1)}:1 — fails WCAG AA (needs 4.5:1). Consider a darker shade.`
    : `Contrast ${contrast.toFixed(1)}:1 — fails WCAG AA. White text will be hard to read on this colour.`;
  const wcagExplainBg = contrast >= 4.5 ? "bg-green-50 text-green-700" : contrast >= 3 ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700";

  return (
    <div className="flex flex-col gap-3 select-none w-full max-w-xs">
      {/* Saturation / brightness square */}
      <div
        ref={squareRef}
        className="relative h-32 w-full rounded-lg cursor-crosshair overflow-hidden"
        style={{ background: `linear-gradient(to right, #ffffff, ${hueColour})` }}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); updateFromSquare(e); }}
        onPointerMove={e => { if (e.buttons > 0) updateFromSquare(e); }}
      >
        {/* Dark overlay top-to-bottom */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent, #000000)" }} />
        {/* Cursor */}
        <div
          className="absolute w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none"
          style={{
            left: `${hsv[1] * 100}%`,
            top: `${(1 - hsv[2]) * 100}%`,
            transform: "translate(-50%, -50%)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
          }}
        />
      </div>

      {/* Hue strip */}
      <div
        ref={hueRef}
        className="relative h-3 w-full rounded-full cursor-pointer overflow-visible"
        style={{ background: "linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))" }}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); updateFromHue(e); }}
        onPointerMove={e => { if (e.buttons > 0) updateFromHue(e); }}
      >
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow pointer-events-none"
          style={{
            left: `${(hsv[0] / 360) * 100}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            background: hueColour,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
          }}
        />
      </div>

      {/* Hex input + swatch + WCAG badge */}
      <div className="flex items-center gap-2">
        <div
          className="h-8 w-8 rounded-md border border-[var(--border-default)] flex-shrink-0"
          style={{ background: value }}
        />
        <input
          type="text"
          className="form-input flex-1 font-mono text-sm"
          placeholder="#6366f1"
          value={hexInput}
          onChange={e => setHexInput(e.target.value)}
          onBlur={() => {
            if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
              const next = hexToHsv(hexInput);
              hsvRef.current = next;
              setHsv(next);
              onChange(hexInput);
            } else {
              setHexInput(value);
            }
          }}
        />
        <span className={`text-[0.7rem] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${wcagBg}`}>
          {wcagLabel}
        </span>
      </div>

      {/* WCAG explanation */}
      <p className={`text-[0.72rem] rounded-md px-3 py-2 ${wcagExplainBg}`}>
        {wcagExplain}
      </p>
    </div>
  );
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run src/components/Admin/Branding/ColorPicker.test.tsx 2>&1
```
Expected: All tests PASS.

- [ ] **Step 3.5: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```
Expected: Zero errors.

- [ ] **Step 3.6: Commit**

```bash
git add apps/web/src/components/Admin/Branding/ColorPicker.tsx apps/web/src/components/Admin/Branding/ColorPicker.test.tsx
git commit -m "feat(branding): custom ColorPicker with WCAG contrast badge"
```

---

## Task 4: `BrandingPreview` component

**Files:**
- Create: `apps/web/src/components/Admin/Branding/BrandingPreview.tsx`
- Create: `apps/web/src/components/Admin/Branding/BrandingPreview.test.tsx`

- [ ] **Step 4.1: Write failing tests**

Create `apps/web/src/components/Admin/Branding/BrandingPreview.test.tsx`:

```typescript
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
    // Sidebar button is rendered
    expect(screen.getByRole("button", { name: /sidebar/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /dashboard/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /login/i })).toBeTruthy();
  });

  it("clicking Dashboard switches the preview screen", () => {
    render(<BrandingPreview {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /dashboard/i }));
    // Dashboard screen shows "Good morning"
    expect(screen.getByText(/good morning/i)).toBeTruthy();
  });

  it("clicking Login switches the preview screen", () => {
    render(<BrandingPreview {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /login/i }));
    // Login screen shows "Sign In" button
    expect(screen.getByText(/sign in/i)).toBeTruthy();
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
```

- [ ] **Step 4.2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run src/components/Admin/Branding/BrandingPreview.test.tsx 2>&1
```
Expected: FAIL — module not found.

- [ ] **Step 4.3: Create `BrandingPreview.tsx`**

Create `apps/web/src/components/Admin/Branding/BrandingPreview.tsx`:

```tsx
/**
 * BrandingPreview.tsx — Live preview panel with Sidebar / Dashboard / Login screen switcher.
 * Uses inline styles with the live primaryColor — does NOT call applyBrandColor()
 * (that would mutate the real app's CSS variables before saving).
 */
import { useState } from "react";

type PreviewScreen = "sidebar" | "dashboard" | "login";

interface BrandingPreviewProps {
  appName: string;
  primaryColor: string;
  logoPreviewUrl: string | null;
}

export function BrandingPreview({ appName, primaryColor, logoPreviewUrl }: BrandingPreviewProps) {
  const [screen, setScreen] = useState<PreviewScreen>("sidebar");

  const monogram = appName.charAt(0).toUpperCase() || "T";
  const btnBase = "px-3 py-1 rounded-full text-[0.72rem] font-medium transition-colors cursor-pointer border-0";
  const btnActive = { background: primaryColor, color: "#ffffff" };
  const btnInactive = { background: "var(--surface-secondary, #f1f5f9)", color: "var(--text-secondary, #64748b)" };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Screen switcher */}
      <div className="flex gap-1">
        {(["sidebar", "dashboard", "login"] as PreviewScreen[]).map(s => (
          <button
            key={s}
            className={btnBase}
            style={screen === s ? btnActive : btnInactive}
            onClick={() => setScreen(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Preview frame */}
      <div className="rounded-lg overflow-hidden border border-[var(--border-default)] flex-1" style={{ minHeight: 280 }}>
        {screen === "sidebar" && <SidebarScreen appName={appName} primaryColor={primaryColor} logoUrl={logoPreviewUrl} monogram={monogram} />}
        {screen === "dashboard" && <DashboardScreen primaryColor={primaryColor} />}
        {screen === "login" && <LoginScreen appName={appName} primaryColor={primaryColor} logoUrl={logoPreviewUrl} monogram={monogram} />}
      </div>

      <p className="text-[0.72rem] text-[var(--text-tertiary)]">
        Preview updates live. Colour + logo applied on Save.
      </p>
    </div>
  );
}

function SidebarScreen({ appName, primaryColor, logoUrl, monogram }: { appName: string; primaryColor: string; logoUrl: string | null; monogram: string }) {
  const navItems = ["Dashboard", "Timesheets", "Leave", "Reports"];
  const adminItems = ["Users", "Branding"];
  return (
    <div className="flex h-full" style={{ minHeight: 280 }}>
      {/* Sidebar */}
      <div className="w-44 flex flex-col h-full p-2.5" style={{ background: "#1e1b4b" }}>
        <div className="flex items-center gap-2 px-2 py-2.5 mb-2">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-6 w-auto max-w-[100px] object-contain" />
          ) : (
            <>
              <div className="h-6 w-6 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: primaryColor }}>{monogram}</div>
              <span className="text-white font-semibold text-[0.8rem] truncate">{appName}</span>
            </>
          )}
        </div>
        <p className="text-[0.62rem] px-2 mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Main</p>
        {navItems.map((item, i) => (
          <div
            key={item}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md mb-0.5 text-[0.78rem]"
            style={i === 0 ? { background: `${primaryColor}33`, color: primaryColor } : { color: "rgba(255,255,255,0.55)" }}
          >
            <div className="h-3 w-3 rounded bg-current opacity-60 flex-shrink-0" />{item}
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-white/10">
          <p className="text-[0.62rem] px-2 mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Admin</p>
          {adminItems.map(item => (
            <div key={item} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md mb-0.5 text-[0.78rem]" style={{ color: "rgba(255,255,255,0.55)" }}>
              <div className="h-3 w-3 rounded bg-current opacity-60 flex-shrink-0" />{item}
            </div>
          ))}
        </div>
      </div>
      {/* Main area */}
      <div className="flex-1 p-4" style={{ background: "var(--surface-primary, #f8fafc)" }}>
        <div className="h-4 w-28 rounded mb-3" style={{ background: "var(--border-default, #e2e8f0)" }} />
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[1, 2].map(i => (
            <div key={i} className="rounded-lg p-3 bg-white border" style={{ borderColor: "var(--border-default, #e2e8f0)" }}>
              <div className="h-2.5 w-12 rounded mb-2" style={{ background: "var(--border-default, #e2e8f0)" }} />
              <div className="h-5 w-10 rounded text-xs font-bold flex items-center justify-center text-white" style={{ background: primaryColor }}>{i * 12}</div>
            </div>
          ))}
        </div>
        <div className="h-7 w-24 rounded flex items-center justify-center text-white text-[0.72rem] font-semibold" style={{ background: primaryColor }}>Submit</div>
      </div>
    </div>
  );
}

function DashboardScreen({ primaryColor }: { primaryColor: string }) {
  return (
    <div className="p-4 h-full" style={{ background: "var(--surface-primary, #f8fafc)", minHeight: 280 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[0.82rem] font-bold" style={{ color: "var(--text-primary, #1e293b)" }}>Good morning, Admin</p>
          <p className="text-[0.72rem]" style={{ color: "var(--text-tertiary, #94a3b8)" }}>Preview — branding applied</p>
        </div>
        <div className="rounded-lg px-3 py-1.5 text-white text-[0.72rem] font-semibold" style={{ background: primaryColor }}>Clock In</div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[["32h", "This week"], ["8d", "Leave"], ["3", "Pending"]].map(([val, label]) => (
          <div key={label} className="bg-white rounded-lg p-2.5 border" style={{ borderColor: "var(--border-default, #e2e8f0)" }}>
            <div className="w-5 h-5 rounded mb-1.5 flex items-center justify-center" style={{ background: `${primaryColor}1a` }}>
              <div className="w-2.5 h-2.5 rounded" style={{ background: primaryColor }} />
            </div>
            <p className="text-[0.85rem] font-bold" style={{ color: primaryColor }}>{val}</p>
            <p className="text-[0.68rem]" style={{ color: "var(--text-tertiary, #94a3b8)" }}>{label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg p-3 border" style={{ borderColor: "var(--border-default, #e2e8f0)" }}>
        <div className="flex justify-between mb-2">
          <p className="text-[0.75rem] font-semibold" style={{ color: "var(--text-primary, #1e293b)" }}>Weekly Progress</p>
          <p className="text-[0.72rem] font-semibold" style={{ color: primaryColor }}>32 / 40h</p>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-default, #e2e8f0)" }}>
          <div className="h-full w-4/5 rounded-full" style={{ background: primaryColor }} />
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ appName, primaryColor, logoUrl, monogram }: { appName: string; primaryColor: string; logoUrl: string | null; monogram: string }) {
  return (
    <div className="flex items-center justify-center h-full p-4" style={{ background: "var(--surface-sunken, #f1f5f9)", minHeight: 280 }}>
      <div className="bg-white rounded-xl p-6 w-full max-w-[200px] border shadow-sm" style={{ borderColor: "var(--border-default, #e2e8f0)" }}>
        <div className="flex flex-col items-center mb-4">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-8 w-auto max-w-[120px] object-contain mb-1" />
          ) : (
            <div className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-base mb-1" style={{ background: primaryColor }}>{monogram}</div>
          )}
          <p className="text-[0.8rem] font-bold" style={{ color: "var(--text-primary, #1e293b)" }}>{appName}</p>
          <p className="text-[0.68rem]" style={{ color: "var(--text-tertiary, #94a3b8)" }}>Sign in to your account</p>
        </div>
        <div className="h-7 rounded-md mb-2 border" style={{ background: "var(--surface-secondary, #f8fafc)", borderColor: "var(--border-default, #e2e8f0)" }} />
        <div className="h-7 rounded-md mb-3 border" style={{ background: "var(--surface-secondary, #f8fafc)", borderColor: "var(--border-default, #e2e8f0)" }} />
        <div className="h-8 rounded-md flex items-center justify-center text-white text-[0.78rem] font-semibold" style={{ background: primaryColor }}>Sign In</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.4: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run src/components/Admin/Branding/BrandingPreview.test.tsx 2>&1
```
Expected: All tests PASS.

- [ ] **Step 4.5: TypeScript check + commit**

```bash
cd apps/web && npx tsc --noEmit 2>&1
git add apps/web/src/components/Admin/Branding/BrandingPreview.tsx apps/web/src/components/Admin/Branding/BrandingPreview.test.tsx
git commit -m "feat(branding): BrandingPreview with Sidebar/Dashboard/Login screens"
```

---

## Task 5: Tab components — Identity, Colors, Assets

**Files:**
- Create: `apps/web/src/components/Admin/Branding/tabs/IdentityTab.tsx`
- Create: `apps/web/src/components/Admin/Branding/tabs/ColorsTab.tsx`
- Create: `apps/web/src/components/Admin/Branding/tabs/AssetsTab.tsx`

- [ ] **Step 5.1: Create `IdentityTab.tsx`**

Create `apps/web/src/components/Admin/Branding/tabs/IdentityTab.tsx`:

```tsx
interface IdentityTabProps {
  appName: string;
  onAppNameChange: (v: string) => void;
}

export function IdentityTab({ appName, onAppNameChange }: IdentityTabProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="form-group">
        <label className="form-label">App Name</label>
        <input
          type="text"
          className="form-input"
          value={appName}
          onChange={e => onAppNameChange(e.target.value)}
          maxLength={100}
          required
          placeholder="TimeSheet"
        />
        <p className="form-hint">Displayed in the sidebar, browser tab, and login page.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.2: Create `ColorsTab.tsx`**

The brand presets are client-side constants. Clicking a preset calls `onPrimaryColorChange` with the preset's hex-500 — the `ColorPicker` and live preview update immediately.

Create `apps/web/src/components/Admin/Branding/tabs/ColorsTab.tsx`:

```tsx
import { ColorPicker } from "../ColorPicker";
import { buildScale } from "../../../../utils/colorUtils";

const PRESETS = [
  { name: "Indigo",      hex: "#6366f1", tagline: "Default"      },
  { name: "Ocean Blue",  hex: "#0ea5e9", tagline: "Professional" },
  { name: "Emerald",     hex: "#10b981", tagline: "Fresh"        },
  { name: "Amber",       hex: "#f59e0b", tagline: "Warm"         },
  { name: "Rose",        hex: "#f43f5e", tagline: "Bold"         },
  { name: "Slate",       hex: "#64748b", tagline: "Neutral"      },
] as const;

interface ColorsTabProps {
  primaryColor: string;
  onPrimaryColorChange: (hex: string) => void;
}

export function ColorsTab({ primaryColor, onPrimaryColorChange }: ColorsTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Colour picker */}
      <div className="form-group">
        <label className="form-label">Primary Colour</label>
        <ColorPicker value={primaryColor} onChange={onPrimaryColorChange} />
      </div>

      {/* Brand presets */}
      <div>
        <p className="form-label mb-2">Brand Presets</p>
        <p className="form-hint mb-3">Click a preset to apply instantly. You can refine further using the picker above.</p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map(preset => {
            const scale = buildScale(preset.hex);
            const isActive = primaryColor.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.name}
                type="button"
                className="text-left rounded-lg p-3 border transition-all cursor-pointer"
                style={isActive
                  ? { borderColor: preset.hex, background: `${preset.hex}0d` }
                  : { borderColor: "var(--border-default, #e2e8f0)", background: "white" }
                }
                onClick={() => onPrimaryColorChange(preset.hex)}
              >
                <div className="flex gap-1.5 mb-2">
                  {[scale[500], scale[400], scale[200]].map(c => (
                    <div key={c} className="w-4 h-4 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                <p className="text-[0.8rem] font-semibold" style={{ color: isActive ? preset.hex : "var(--text-primary, #1e293b)" }}>{preset.name}</p>
                <p className="text-[0.72rem]" style={{ color: "var(--text-tertiary, #94a3b8)" }}>{preset.tagline}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.3: Create `AssetsTab.tsx`**

The drag-and-drop zone uses the `dragover` / `drop` events. On file selection, a `FileReader` produces an object URL for the dual-background preview. "Remove" either clears a staged file (no API call) or calls DELETE for an already-saved URL.

Create `apps/web/src/components/Admin/Branding/tabs/AssetsTab.tsx`:

```tsx
import { useRef } from "react";
import { apiFetch, API_BASE } from "../../../../api/client";
import { useToast } from "../../../../contexts/ToastContext";

interface AssetsTabProps {
  logoFile: File | null;
  faviconFile: File | null;
  currentLogoUrl: string | null;
  currentFaviconUrl: string | null;
  onLogoFileChange: (file: File | null) => void;
  onFaviconFileChange: (file: File | null) => void;
  onCurrentLogoUrlChange: (url: string | null) => void;
  onCurrentFaviconUrlChange: (url: string | null) => void;
}

export function AssetsTab({
  logoFile, faviconFile,
  currentLogoUrl, currentFaviconUrl,
  onLogoFileChange, onFaviconFileChange,
  onCurrentLogoUrlChange, onCurrentFaviconUrlChange,
}: AssetsTabProps) {
  const toast = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const logoPreviewUrl = logoFile
    ? URL.createObjectURL(logoFile)
    : currentLogoUrl ? `${API_BASE.replace("/api/v1", "")}${currentLogoUrl}` : null;

  const faviconPreviewUrl = faviconFile
    ? URL.createObjectURL(faviconFile)
    : currentFaviconUrl ? `${API_BASE.replace("/api/v1", "")}${currentFaviconUrl}` : null;

  function handleFileDrop(e: React.DragEvent, kind: "logo" | "favicon") {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (kind === "logo") onLogoFileChange(file);
    else onFaviconFileChange(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>, kind: "logo" | "favicon") {
    const file = e.target.files?.[0] ?? null;
    if (kind === "logo") onLogoFileChange(file);
    else onFaviconFileChange(file);
    e.target.value = "";
  }

  async function handleRemoveLogo() {
    if (logoFile) { onLogoFileChange(null); return; }
    const r = await apiFetch("/tenant/settings/logo", { method: "DELETE" });
    if (r.ok) { onCurrentLogoUrlChange(null); toast.success("Logo removed"); }
    else toast.error("Failed to remove logo");
  }

  async function handleRemoveFavicon() {
    if (faviconFile) { onFaviconFileChange(null); return; }
    const r = await apiFetch("/tenant/settings/favicon", { method: "DELETE" });
    if (r.ok) { onCurrentFaviconUrlChange(null); toast.success("Favicon removed"); }
    else toast.error("Failed to remove favicon");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Logo */}
      <div className="form-group">
        <label className="form-label">Logo</label>
        <div
          className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-3 cursor-pointer transition-colors hover:border-[var(--color-primary)]"
          style={{ borderColor: "var(--border-default, #e2e8f0)" }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleFileDrop(e, "logo")}
          onClick={() => logoInputRef.current?.click()}
        >
          {logoPreviewUrl ? (
            <div className="flex gap-3 items-center">
              <div className="border rounded-md p-2 bg-white" style={{ borderColor: "var(--border-default, #e2e8f0)" }}>
                <img src={logoPreviewUrl} alt="Logo on light" className="h-8 w-auto max-w-[120px] object-contain" />
              </div>
              <div className="border rounded-md p-2" style={{ background: "#1e1b4b", borderColor: "#1e1b4b" }}>
                <img src={logoPreviewUrl} alt="Logo on dark" className="h-8 w-auto max-w-[120px] object-contain" />
              </div>
            </div>
          ) : (
            <div className="text-[0.8rem] text-center" style={{ color: "var(--text-tertiary, #94a3b8)" }}>
              <p className="font-medium">Drop your logo here</p>
              <p>or click to browse</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => logoInputRef.current?.click()}>
            {logoPreviewUrl ? "Change" : "Upload Logo"}
          </button>
          {(logoPreviewUrl) && (
            <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => void handleRemoveLogo()}>
              Remove
            </button>
          )}
        </div>
        <input ref={logoInputRef} type="file" accept=".png,.jpg,.jpeg,.svg,.webp,image/*" className="hidden" onChange={e => handleFileInput(e, "logo")} />
        <p className="form-hint">Recommended: 200×60 px PNG or SVG. Shown in the sidebar.</p>
      </div>

      {/* Favicon */}
      <div className="form-group">
        <label className="form-label">Favicon</label>
        <div
          className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-3 cursor-pointer transition-colors hover:border-[var(--color-primary)]"
          style={{ borderColor: "var(--border-default, #e2e8f0)" }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleFileDrop(e, "favicon")}
          onClick={() => faviconInputRef.current?.click()}
        >
          {faviconPreviewUrl ? (
            <img src={faviconPreviewUrl} alt="Favicon preview" className="h-8 w-8 object-contain rounded border" style={{ borderColor: "var(--border-default, #e2e8f0)" }} />
          ) : (
            <div className="text-[0.8rem] text-center" style={{ color: "var(--text-tertiary, #94a3b8)" }}>
              <p className="font-medium">Drop your favicon here</p>
              <p>or click to browse</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => faviconInputRef.current?.click()}>
            {faviconPreviewUrl ? "Change" : "Upload Favicon"}
          </button>
          {faviconPreviewUrl && (
            <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => void handleRemoveFavicon()}>
              Remove
            </button>
          )}
        </div>
        <input ref={faviconInputRef} type="file" accept=".png,.ico,.svg,image/*" className="hidden" onChange={e => handleFileInput(e, "favicon")} />
        <p className="form-hint">Recommended: 32×32 px ICO or PNG.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.4: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```
Expected: Zero errors.

- [ ] **Step 5.5: Commit**

```bash
git add apps/web/src/components/Admin/Branding/tabs/IdentityTab.tsx apps/web/src/components/Admin/Branding/tabs/ColorsTab.tsx apps/web/src/components/Admin/Branding/tabs/AssetsTab.tsx
git commit -m "feat(branding): Identity, Colors, and Assets tab components"
```

---

## Task 6: Placeholder tabs + Advanced tab

**Files:**
- Create: `apps/web/src/components/Admin/Branding/tabs/LoginTab.tsx`
- Create: `apps/web/src/components/Admin/Branding/tabs/EmailsTab.tsx`
- Create: `apps/web/src/components/Admin/Branding/tabs/AdvancedTab.tsx`

- [ ] **Step 6.1: Create `LoginTab.tsx`**

Create `apps/web/src/components/Admin/Branding/tabs/LoginTab.tsx`:

```tsx
import { Lock } from "lucide-react";

export function LoginTab() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: "var(--surface-secondary, #f1f5f9)" }}>
        <Lock size={18} style={{ color: "var(--text-tertiary, #94a3b8)" }} />
      </div>
      <p className="text-[0.9rem] font-semibold" style={{ color: "var(--text-primary, #1e293b)" }}>Login Page Customisation</p>
      <p className="text-[0.8rem] max-w-xs" style={{ color: "var(--text-secondary, #64748b)" }}>
        Customise the background, tagline, and hero image on your login page. Ships in Sprint 42.
      </p>
      <span className="badge badge-info text-[0.72rem]">Coming soon</span>
    </div>
  );
}
```

- [ ] **Step 6.2: Create `EmailsTab.tsx`**

Create `apps/web/src/components/Admin/Branding/tabs/EmailsTab.tsx`:

```tsx
import { Mail } from "lucide-react";

export function EmailsTab() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: "var(--surface-secondary, #f1f5f9)" }}>
        <Mail size={18} style={{ color: "var(--text-tertiary, #94a3b8)" }} />
      </div>
      <p className="text-[0.9rem] font-semibold" style={{ color: "var(--text-primary, #1e293b)" }}>Email Template Branding</p>
      <p className="text-[0.8rem] max-w-xs" style={{ color: "var(--text-secondary, #64748b)" }}>
        Customise the logo, header colour, and footer text in system notification emails. Ships in Sprint 42.
      </p>
      <span className="badge badge-info text-[0.72rem]">Coming soon</span>
    </div>
  );
}
```

- [ ] **Step 6.3: Create `AdvancedTab.tsx`**

Create `apps/web/src/components/Admin/Branding/tabs/AdvancedTab.tsx`:

```tsx
interface AdvancedTabProps {
  customDomain: string;
  onCustomDomainChange: (v: string) => void;
}

export function AdvancedTab({ customDomain, onCustomDomainChange }: AdvancedTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Custom Domain — live in Sprint 40 */}
      <div className="form-group">
        <label className="form-label">
          Custom Domain <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
        </label>
        <input
          type="text"
          className="form-input"
          value={customDomain}
          onChange={e => onCustomDomainChange(e.target.value)}
          placeholder="app.yourcompany.com"
          maxLength={255}
        />
        <p className="form-hint">Leave blank to use the default domain. DNS configuration is outside the app.</p>
      </div>

      {/* Custom CSS — Sprint 41 stub */}
      <div className="form-group opacity-50 pointer-events-none">
        <div className="flex items-center gap-2 mb-1">
          <label className="form-label mb-0">Custom CSS</label>
          <span className="badge badge-info text-[0.68rem]">Coming in Sprint 41</span>
        </div>
        <textarea
          className="form-input font-mono text-sm resize-none"
          rows={5}
          disabled
          placeholder="/* Override any CSS variable or class here */"
        />
        <p className="form-hint">For advanced users — changes here can break the UI.</p>
      </div>

      {/* JSON Export / Import — Sprint 41 stub */}
      <div className="form-group opacity-50 pointer-events-none">
        <div className="flex items-center gap-2 mb-2">
          <label className="form-label mb-0">Branding Export / Import</label>
          <span className="badge badge-info text-[0.68rem]">Coming in Sprint 41</span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary btn-sm" disabled>Export JSON</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled>Import JSON</button>
        </div>
        <p className="form-hint">Export your full branding config as JSON, or import one from another workspace.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6.4: TypeScript check + commit**

```bash
cd apps/web && npx tsc --noEmit 2>&1
git add apps/web/src/components/Admin/Branding/tabs/LoginTab.tsx apps/web/src/components/Admin/Branding/tabs/EmailsTab.tsx apps/web/src/components/Admin/Branding/tabs/AdvancedTab.tsx
git commit -m "feat(branding): Login/Emails placeholder tabs + Advanced tab"
```

---

## Task 7: `TenantBranding` page shell

**Files:**
- Create: `apps/web/src/components/Admin/Branding/TenantBranding.tsx`
- Create: `apps/web/src/components/Admin/Branding/TenantBranding.test.tsx`

- [ ] **Step 7.1: Write failing tests**

Create `apps/web/src/components/Admin/Branding/TenantBranding.test.tsx`:

```typescript
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
```

- [ ] **Step 7.2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run src/components/Admin/Branding/TenantBranding.test.tsx 2>&1
```
Expected: FAIL — module not found.

- [ ] **Step 7.3: Create `TenantBranding.tsx`**

Create `apps/web/src/components/Admin/Branding/TenantBranding.tsx`:

```tsx
/**
 * TenantBranding.tsx — Page shell for the Branding admin page.
 * Owns the tab bar, dirty banner, Save button, and wires all sub-components.
 */
import { useState } from "react";
import { useBrandingForm } from "./useBrandingForm";
import { BrandingPreview } from "./BrandingPreview";
import { IdentityTab } from "./tabs/IdentityTab";
import { ColorsTab } from "./tabs/ColorsTab";
import { AssetsTab } from "./tabs/AssetsTab";
import { LoginTab } from "./tabs/LoginTab";
import { EmailsTab } from "./tabs/EmailsTab";
import { AdvancedTab } from "./tabs/AdvancedTab";
import { useToast } from "../../../contexts/ToastContext";
import { API_BASE } from "../../../api/client";

type Tab = "identity" | "colors" | "assets" | "login" | "emails" | "advanced";

const TABS: { id: Tab; label: string }[] = [
  { id: "identity",  label: "Identity"  },
  { id: "colors",    label: "Colors"    },
  { id: "assets",    label: "Assets"    },
  { id: "login",     label: "Login"     },
  { id: "emails",    label: "Emails"    },
  { id: "advanced",  label: "Advanced"  },
];

export function TenantBranding() {
  const toast = useToast();
  const { form, loading, saving, isDirty, setField, setLogoFile, setFaviconFile, setCurrentLogoUrl, setCurrentFaviconUrl, reset, save } = useBrandingForm();
  const [activeTab, setActiveTab] = useState<Tab>("identity");

  async function handleSave() {
    const ok = await save();
    if (ok) toast.success("Branding saved");
    else toast.error("Failed to save branding");
  }

  const logoPreviewUrl = form.logoFile
    ? URL.createObjectURL(form.logoFile)
    : form.currentLogoUrl ? `${API_BASE.replace("/api/v1", "")}${form.currentLogoUrl}` : null;

  if (loading) {
    return (
      <div className="page-content">
        <div className="skeleton w-48 h-6 rounded mb-4" />
        <div className="skeleton w-full h-96 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Branding</h1>
          <p className="page-subtitle">Customise your organisation&apos;s appearance</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving || !isDirty}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save Branding"}
        </button>
      </div>

      {/* Unsaved changes banner */}
      {isDirty && (
        <div className="flex items-center justify-between rounded-lg px-4 py-2.5 mb-4 border" style={{ background: "#fefce8", borderColor: "#fde047" }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: "#eab308" }} />
            <span className="text-[0.82rem] font-medium" style={{ color: "#854d0e" }}>You have unsaved changes</span>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Discard</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving…" : "Save Branding"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Left: tab card */}
        <div className="card overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-[var(--border-subtle)] overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                className="px-4 py-3 text-[0.82rem] font-medium whitespace-nowrap border-b-2 transition-colors"
                style={activeTab === tab.id
                  ? { borderBottomColor: "var(--color-primary, #6366f1)", color: "var(--color-primary, #6366f1)" }
                  : { borderBottomColor: "transparent", color: "var(--text-secondary, #64748b)" }
                }
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === "identity" && (
              <IdentityTab appName={form.appName} onAppNameChange={v => setField("appName", v)} />
            )}
            {activeTab === "colors" && (
              <ColorsTab primaryColor={form.primaryColor} onPrimaryColorChange={v => setField("primaryColor", v)} />
            )}
            {activeTab === "assets" && (
              <AssetsTab
                logoFile={form.logoFile}
                faviconFile={form.faviconFile}
                currentLogoUrl={form.currentLogoUrl}
                currentFaviconUrl={form.currentFaviconUrl}
                onLogoFileChange={setLogoFile}
                onFaviconFileChange={setFaviconFile}
                onCurrentLogoUrlChange={setCurrentLogoUrl}
                onCurrentFaviconUrlChange={setCurrentFaviconUrl}
              />
            )}
            {activeTab === "login"    && <LoginTab />}
            {activeTab === "emails"   && <EmailsTab />}
            {activeTab === "advanced" && (
              <AdvancedTab customDomain={form.customDomain} onCustomDomainChange={v => setField("customDomain", v)} />
            )}
          </div>
        </div>

        {/* Right: live preview */}
        <div className="card p-5 lg:sticky lg:top-6">
          <h2 className="text-[0.85rem] font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Live Preview</h2>
          <BrandingPreview
            appName={form.appName}
            primaryColor={form.primaryColor}
            logoPreviewUrl={logoPreviewUrl}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7.4: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run src/components/Admin/Branding/TenantBranding.test.tsx 2>&1
```
Expected: All tests PASS.

- [ ] **Step 7.5: Run the full test suite**

```bash
cd apps/web && npx vitest run 2>&1
```
Expected: All tests PASS (no regressions).

- [ ] **Step 7.6: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```
Expected: Zero errors.

- [ ] **Step 7.7: Commit**

```bash
git add apps/web/src/components/Admin/Branding/TenantBranding.tsx apps/web/src/components/Admin/Branding/TenantBranding.test.tsx
git commit -m "feat(branding): TenantBranding page shell with tabs, dirty banner, and preview"
```

---

## Task 8: Wire into App + cleanup

**Files:**
- Modify: `apps/web/src/App.tsx`
- Delete: `apps/web/src/components/Admin/TenantBranding.tsx`

- [ ] **Step 8.1: Update import in `App.tsx`**

In `apps/web/src/App.tsx`, change the import line:

```typescript
// Before
import { TenantBranding } from "./components/Admin/TenantBranding";

// After
import { TenantBranding } from "./components/Admin/Branding/TenantBranding";
```

- [ ] **Step 8.2: Delete old file**

```bash
rm apps/web/src/components/Admin/TenantBranding.tsx
```

- [ ] **Step 8.3: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```
Expected: Zero errors.

- [ ] **Step 8.4: Run the full test suite**

```bash
cd apps/web && npx vitest run 2>&1
```
Expected: All tests PASS.

- [ ] **Step 8.5: Commit**

```bash
git add apps/web/src/App.tsx
git rm apps/web/src/components/Admin/TenantBranding.tsx
git commit -m "feat(sprint-40): wire new Branding page into App, remove old TenantBranding.tsx"
```

---

## Task 9: Push and raise PR

- [ ] **Step 9.1: Push branch**

```bash
git push -u origin feature/sprint-40-branding-ux
```

- [ ] **Step 9.2: Create PR**

```bash
gh pr create \
  --title "feat(sprint-40): Branding Page UX Overhaul" \
  --body "$(cat <<'EOF'
## Summary
- Rebuilt flat Branding page into a 6-tab layout (Identity / Colors / Assets / Login / Emails / Advanced)
- Custom colour picker: saturation square + hue strip + WCAG AA/AAA contrast badge
- 6 brand colour preset templates (Indigo, Ocean Blue, Emerald, Amber, Rose, Slate)
- Drag-and-drop logo + favicon upload with dual light/dark background preview
- Live preview panel with Sidebar / Dashboard / Login screen switcher
- Single shared form state via \`useBrandingForm\` hook with dirty tracking
- Unsaved changes sticky banner with Discard + Save actions
- Extracted colour math to \`utils/colorUtils.ts\`

## Test plan
- [ ] All 6 tabs render; Login and Emails show coming-soon placeholders
- [ ] Colour picker: drag square + hue strip updates preview live
- [ ] WCAG badge changes colour/text on every picker change
- [ ] Clicking a preset card updates picker and preview immediately
- [ ] Logo/favicon: drag-and-drop and click-to-browse both work
- [ ] Logo preview shows on both white and dark backgrounds
- [ ] Unsaved banner appears on first change, disappears after Save or Discard
- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 9.3: Update PROJECT_TASKS.md**

Add Sprint 40 to `PROJECT_TASKS.md` under the Sprint Delivery Order table and mark all tasks done after testing:

In the roadmap table, add:
```markdown
| 40 | Branding Page UX Overhaul | ✅ DONE | merged |
```

---

## Self-Review Checklist

Checking spec coverage:

| Spec requirement | Task |
|-----------------|------|
| 6-tab layout | Task 7 (`TenantBranding.tsx` tab bar) |
| Horizontal tabs (Option B) | Task 7 |
| Custom colour picker: sat square + hue strip | Task 3 |
| WCAG AA/AAA contrast badge | Task 3 |
| 6 brand preset templates | Task 5 (`ColorsTab`) |
| Drag-and-drop logo upload | Task 5 (`AssetsTab`) |
| Dual light/dark logo preview | Task 5 (`AssetsTab`) |
| Favicon drag-and-drop | Task 5 (`AssetsTab`) |
| Live preview — Sidebar screen | Task 4 |
| Live preview — Dashboard screen | Task 4 |
| Live preview — Login screen | Task 4 |
| Preview uses inline styles (no CSS var mutation) | Task 4 |
| `useBrandingForm` hook | Task 2 |
| isDirty tracking | Task 2 |
| Unsaved changes banner | Task 7 |
| Discard reverts to snapshot | Task 2 + 7 |
| Save calls `applyBrandColor` + `document.title` | Task 2 (`save()`) |
| Login tab placeholder | Task 6 |
| Emails tab placeholder | Task 6 |
| Advanced: Custom Domain | Task 6 |
| Advanced: CSS/JSON locked stubs | Task 6 |
| `colorUtils.ts` extracted | Task 1 |
| `TenantSettingsContext` uses colorUtils | Task 1 |
| App.tsx import path updated | Task 8 |
| Old TenantBranding.tsx deleted | Task 8 |
| No backend changes required | ✓ no backend tasks |
| `npx tsc --noEmit` passes | Steps 1.6, 2.5, 3.5, 4.5, 5.4, 6.4, 7.6, 8.3 |
