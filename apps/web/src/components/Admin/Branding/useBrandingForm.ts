import { useCallback, useEffect, useRef, useState } from "react";
import { applyBrandColor } from "../../../utils/colorUtils";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5000/api/v1";

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
