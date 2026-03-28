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

        if (data.primaryColor) {
          document.documentElement.style.setProperty("--color-brand-500", data.primaryColor);
          document.documentElement.style.setProperty("--color-brand-700", darken(data.primaryColor, 0.15));
        }

        if (data.appName) document.title = data.appName;

        if (data.faviconUrl) {
          let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = `http://localhost:5000${data.faviconUrl}`;
        }
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

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}
