/**
 * TenantBranding.tsx — Page shell for the Branding admin page.
 * Owns the tab bar, sticky save footer, beforeunload guard, and wires all sub-components.
 */
import { useEffect, useState } from "react";
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
import { AppTabs, type AppTab } from "../../ui";

type Tab = "identity" | "colors" | "assets" | "login" | "emails" | "advanced";

const TABS: AppTab<Tab>[] = [
  { key: "identity", label: "Identity" },
  { key: "colors",   label: "Colours" },
  { key: "assets",   label: "Assets" },
  { key: "login",    label: "Login",   disabled: true },
  { key: "emails",   label: "Emails",  disabled: true },
  { key: "advanced", label: "Advanced" },
];

export function TenantBranding() {
  const toast = useToast();
  const { form, loading, saving, isDirty, setField, setLogoFile, setFaviconFile, setCurrentLogoUrl, setCurrentFaviconUrl, reset, save } = useBrandingForm();
  const [activeTab, setActiveTab] = useState<Tab>("identity");

  // Warn browser before unloading with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Left: tab card */}
        <div className="card overflow-hidden">
          {/* Tab bar */}
          <AppTabs
            tabs={TABS}
            active={activeTab}
            onChange={setActiveTab}
            variant="line"
            className="overflow-x-auto px-1"
          />

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

        {/* Right: live preview — aria-hidden since it's a decorative preview */}
        <div className="card p-5 lg:sticky lg:top-6" aria-hidden="true">
          <h2 className="text-[0.85rem] font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Live Preview</h2>
          <BrandingPreview
            appName={form.appName}
            primaryColor={form.primaryColor}
            logoPreviewUrl={logoPreviewUrl}
          />
        </div>
      </div>

      {/* Sticky save footer — visible only when there are unsaved changes */}
      {isDirty && (
        <div
          className="sticky bottom-0 z-20 mt-6 flex items-center justify-between border-t"
          style={{
            background: "var(--n-0, white)",
            borderColor: "var(--border-default)",
            margin: "1.5rem calc(-1 * var(--space-5)) 0",
            padding: "0.75rem var(--space-5)",
          }}
        >
          <span className="text-[0.82rem] font-medium" style={{ color: "var(--text-secondary)" }}>
            You have unsaved changes
          </span>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
              Discard Changes
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : "Save Branding"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
