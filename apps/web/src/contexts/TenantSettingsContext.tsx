import { createContext, useContext, useEffect, useState } from "react";
import { applyBrandColor } from "../utils/colorUtils";
export { applyBrandColor } from "../utils/colorUtils";

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
          link.href = `${API_BASE}${data.faviconUrl}`;
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
