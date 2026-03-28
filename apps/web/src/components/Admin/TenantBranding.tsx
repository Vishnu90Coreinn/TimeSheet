/**
 * TenantBranding.tsx — White-label branding settings for admin.
 * Left: settings form. Right: live preview of sidebar with selected branding.
 */
import { useEffect, useRef, useState } from "react";
import { apiFetch, API_BASE } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";

interface BrandingForm {
  appName: string;
  primaryColor: string;
  customDomain: string;
}

interface TenantSettingsResponse {
  appName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  customDomain: string | null;
}

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

export function TenantBranding() {
  const toast = useToast();

  const [form, setForm] = useState<BrandingForm>({
    appName: "TimeSheet",
    primaryColor: "#6366f1",
    customDomain: "",
  });
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [currentFaviconUrl, setCurrentFaviconUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch("/tenant/settings")
      .then(r => r.ok ? r.json() : null)
      .then((data: TenantSettingsResponse | null) => {
        if (!data) return;
        setForm({
          appName: data.appName ?? "TimeSheet",
          primaryColor: data.primaryColor ?? "#6366f1",
          customDomain: data.customDomain ?? "",
        });
        setCurrentLogoUrl(data.logoUrl);
        setCurrentFaviconUrl(data.faviconUrl);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
    } else {
      setLogoPreview(null);
    }
  }

  function handleFaviconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFaviconFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setFaviconPreview(url);
    } else {
      setFaviconPreview(null);
    }
  }

  async function handleRemoveLogo() {
    const r = await apiFetch("/tenant/settings/logo", { method: "DELETE" });
    if (r.ok) {
      setCurrentLogoUrl(null);
      setLogoFile(null);
      setLogoPreview(null);
      toast.success("Logo removed");
    }
  }

  async function handleRemoveFavicon() {
    const r = await apiFetch("/tenant/settings/favicon", { method: "DELETE" });
    if (r.ok) {
      setCurrentFaviconUrl(null);
      setFaviconFile(null);
      setFaviconPreview(null);
      toast.success("Favicon removed");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const token = localStorage.getItem("accessToken");
    const formData = new FormData();
    formData.append("appName", form.appName);
    formData.append("primaryColor", form.primaryColor);
    formData.append("customDomain", form.customDomain);
    if (logoFile) formData.append("logo", logoFile);
    if (faviconFile) formData.append("favicon", faviconFile);

    try {
      const response = await fetch(`${API_BASE}/tenant/settings`, {
        method: "PUT",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (response.ok) {
        const data: TenantSettingsResponse = await response.json();
        setCurrentLogoUrl(data.logoUrl);
        setCurrentFaviconUrl(data.faviconUrl);
        setLogoFile(null);
        setFaviconFile(null);
        setLogoPreview(null);
        setFaviconPreview(null);

        // Apply CSS variable override immediately
        document.documentElement.style.setProperty("--color-brand-500", form.primaryColor);
        document.documentElement.style.setProperty("--color-brand-700", darken(form.primaryColor, 0.15));
        document.title = form.appName;

        toast.success("Branding saved");
      } else {
        toast.error("Failed to save branding");
      }
    } catch {
      toast.error("Failed to save branding");
    } finally {
      setSaving(false);
    }
  }

  const previewLogo = logoPreview ?? (currentLogoUrl ? `http://localhost:5000${currentLogoUrl}` : null);

  if (loading) {
    return (
      <div className="page-content">
        <div className="skeleton skeleton-text w-48 h-6 mb-4" />
        <div className="skeleton w-full h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Branding</h1>
        <p className="page-subtitle">Customise your organisation&apos;s appearance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Form */}
        <form onSubmit={e => void handleSave(e)} className="card p-6 space-y-6">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Settings</h2>

          {/* App Name */}
          <div className="form-group">
            <label className="form-label">App Name</label>
            <input
              type="text"
              className="form-input"
              value={form.appName}
              onChange={e => setForm(f => ({ ...f, appName: e.target.value }))}
              maxLength={100}
              required
            />
          </div>

          {/* Primary Colour */}
          <div className="form-group">
            <label className="form-label">Primary Colour</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="h-9 w-14 cursor-pointer rounded border border-[var(--border-default)] bg-transparent p-0.5"
                value={form.primaryColor}
                onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
              />
              <input
                type="text"
                className="form-input w-32 font-mono text-sm"
                value={form.primaryColor}
                onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                pattern="^#[0-9a-fA-F]{6}$"
                placeholder="#6366f1"
              />
            </div>
          </div>

          {/* Logo Upload */}
          <div className="form-group">
            <label className="form-label">Logo</label>
            <div className="flex items-center gap-3 flex-wrap">
              {previewLogo && (
                <img
                  src={previewLogo}
                  alt="Logo preview"
                  className="h-10 w-auto max-w-[160px] object-contain rounded border border-[var(--border-default)] p-1 bg-white"
                />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => logoInputRef.current?.click()}
                >
                  {previewLogo ? "Change" : "Upload Logo"}
                </button>
                {(previewLogo || currentLogoUrl) && (
                  <button
                    type="button"
                    className="btn btn-danger-outline btn-sm"
                    onClick={() => void handleRemoveLogo()}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
            <p className="form-hint">Recommended: 200×60px PNG or SVG. Shown in the sidebar.</p>
          </div>

          {/* Favicon Upload */}
          <div className="form-group">
            <label className="form-label">Favicon</label>
            <div className="flex items-center gap-3 flex-wrap">
              {(faviconPreview ?? (currentFaviconUrl ? `http://localhost:5000${currentFaviconUrl}` : null)) && (
                <img
                  src={faviconPreview ?? `http://localhost:5000${currentFaviconUrl}`}
                  alt="Favicon preview"
                  className="h-8 w-8 object-contain rounded border border-[var(--border-default)] p-0.5 bg-white"
                />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => faviconInputRef.current?.click()}
                >
                  {currentFaviconUrl || faviconFile ? "Change" : "Upload Favicon"}
                </button>
                {(currentFaviconUrl || faviconFile) && (
                  <button
                    type="button"
                    className="btn btn-danger-outline btn-sm"
                    onClick={() => void handleRemoveFavicon()}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFaviconChange}
            />
            <p className="form-hint">Recommended: 32×32px ICO or PNG.</p>
          </div>

          {/* Custom Domain */}
          <div className="form-group">
            <label className="form-label">Custom Domain <span className="text-[var(--text-tertiary)] font-normal">(optional)</span></label>
            <input
              type="text"
              className="form-input"
              value={form.customDomain}
              onChange={e => setForm(f => ({ ...f, customDomain: e.target.value }))}
              placeholder="app.yourcompany.com"
              maxLength={255}
            />
            <p className="form-hint">Leave blank to use the default domain.</p>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save Branding"}
            </button>
          </div>
        </form>

        {/* Live Preview */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">Live Preview</h2>
          <div className="rounded-lg overflow-hidden border border-[var(--border-default)]" style={{ height: 340 }}>
            {/* Sidebar mockup */}
            <div
              className="flex h-full"
              style={{ background: "var(--sidebar-bg, #1e1b4b)" }}
            >
              <div className="w-52 flex flex-col h-full p-3" style={{ background: "var(--sidebar-bg, #1e1b4b)" }}>
                {/* Brand */}
                <div className="flex items-center gap-2 px-2 py-3 mb-3">
                  {previewLogo ? (
                    <img src={previewLogo} alt={form.appName} className="h-7 w-auto max-w-[120px] object-contain" />
                  ) : (
                    <>
                      <div
                        className="h-7 w-7 rounded flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ background: form.primaryColor }}
                      >
                        {form.appName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white font-semibold text-sm truncate">{form.appName || "TimeSheet"}</span>
                    </>
                  )}
                </div>

                {/* Mock nav items */}
                {["Dashboard", "Timesheets", "Leave", "Approvals"].map((item, i) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 px-3 py-2 rounded-md mb-0.5 text-sm"
                    style={{
                      background: i === 0 ? form.primaryColor + "33" : "transparent",
                      color: i === 0 ? form.primaryColor : "rgba(255,255,255,0.6)",
                    }}
                  >
                    <div className="h-3.5 w-3.5 rounded bg-current opacity-60" />
                    {item}
                  </div>
                ))}

                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-[10px] px-3 mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Admin</p>
                  {["Users", "Branding"].map(item => (
                    <div
                      key={item}
                      className="flex items-center gap-2 px-3 py-2 rounded-md mb-0.5 text-sm"
                      style={{ color: "rgba(255,255,255,0.6)" }}
                    >
                      <div className="h-3.5 w-3.5 rounded bg-current opacity-60" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Main area mockup */}
              <div className="flex-1 bg-[var(--surface-primary,#f8fafc)] p-4">
                <div className="h-5 w-32 rounded bg-[var(--border-default,#e2e8f0)] mb-3" />
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[1, 2].map(i => (
                    <div key={i} className="rounded-md p-3 bg-white border border-[var(--border-default,#e2e8f0)]">
                      <div className="h-2.5 w-16 rounded bg-[var(--border-default,#e2e8f0)] mb-2" />
                      <div
                        className="h-5 w-10 rounded text-xs font-bold flex items-center justify-center text-white"
                        style={{ background: form.primaryColor }}
                      >
                        {i * 12}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-md bg-white border border-[var(--border-default,#e2e8f0)] p-3">
                  <div className="h-2 w-24 rounded bg-[var(--border-default,#e2e8f0)] mb-2" />
                  <div className="h-2 w-full rounded bg-[var(--border-default,#e2e8f0)] mb-1.5" />
                  <div className="h-2 w-4/5 rounded bg-[var(--border-default,#e2e8f0)]" />
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-3">Preview updates as you change settings. Save to apply.</p>
        </div>
      </div>
    </div>
  );
}
