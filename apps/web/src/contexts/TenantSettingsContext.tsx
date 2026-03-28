import { createContext, useContext, useEffect, useState } from "react";

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
        if (data.faviconUrl) applyFavicon(data.faviconUrl);
      })
      .catch(() => {/* silently ignore — defaults apply */});
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

/** Apply a full brand colour scale from a single hex500 value.
 *  Sets both --brand-* (used by buttons, sidebar, etc.) and
 *  --color-brand-* (Tailwind v4 @theme utilities) on :root.
 */
export function applyBrandColor(hex500: string) {
  const root = document.documentElement;
  const scale = buildScale(hex500);

  // Semantic --brand-* vars (used by design-system.css directly)
  for (const [stop, value] of Object.entries(scale)) {
    root.style.setProperty(`--brand-${stop}`, value);
    root.style.setProperty(`--color-brand-${stop}`, value);
  }

  // Derived semantic aliases
  root.style.setProperty("--color-primary",        scale[600]);
  root.style.setProperty("--color-primary-hover",  scale[700]);
  root.style.setProperty("--color-primary-light",  scale[300]);
  root.style.setProperty("--color-primary-subtle", scale[50]);
  root.style.setProperty("--color-border-focus",   scale[500]);
  root.style.setProperty("--text-brand",           scale[700]);
  root.style.setProperty("--border-brand",         scale[400]);
}

function applyFavicon(faviconUrl: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = `http://localhost:5000${faviconUrl}`;
}

/** Generate a 9-stop colour scale (50–900) from a 500-stop hex value using HSL. */
function buildScale(hex: string): Record<number, string> {
  const [h, s, l] = hexToHsl(hex);
  // Lightness targets per stop (approximate Tailwind-style scale)
  const stops: [number, number][] = [
    [50,  0.97],
    [100, 0.93],
    [200, 0.86],
    [300, 0.76],
    [400, 0.63],
    [500, l],         // anchor: use exact input
    [600, l * 0.85],
    [700, l * 0.70],
    [800, l * 0.55],
    [900, l * 0.42],
  ];
  return Object.fromEntries(
    stops.map(([stop, lightness]) => [stop, hslToHex(h, s, lightness)])
  );
}

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >>  8) & 0xff) / 255;
  const b = ( n        & 0xff) / 255;
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

function hslToHex(h: number, s: number, l: number): string {
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
