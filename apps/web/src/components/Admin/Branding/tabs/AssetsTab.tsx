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
