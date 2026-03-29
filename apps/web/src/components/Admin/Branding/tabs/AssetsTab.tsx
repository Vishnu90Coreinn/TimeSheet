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
      {/* ── Logo ────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label className="form-label">Logo</label>

        {logoPreviewUrl ? (
          /* Preview state — thumbnail + filename + actions */
          <div className="flex items-center gap-4 rounded-lg border p-4" style={{ borderColor: "var(--border-default, #e2e8f0)" }}>
            <div className="flex gap-3 items-center flex-1 min-w-0">
              <div className="border rounded-md p-2 bg-white flex-shrink-0" style={{ borderColor: "var(--border-default, #e2e8f0)" }}>
                <img src={logoPreviewUrl} alt="Logo on light background" className="h-8 w-auto max-w-[100px] object-contain" />
              </div>
              <div className="border rounded-md p-2 flex-shrink-0" style={{ background: "#1e1b4b", borderColor: "#1e1b4b" }}>
                <img src={logoPreviewUrl} alt="Logo on dark background" className="h-8 w-auto max-w-[100px] object-contain" />
              </div>
              {logoFile && (
                <span className="text-[0.78rem] truncate min-w-0" style={{ color: "var(--text-secondary)" }}>
                  {logoFile.name}
                </span>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => logoInputRef.current?.click()}>
                Change
              </button>
              <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => void handleRemoveLogo()}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          /* Empty drop zone */
          <div
            className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors hover:border-[var(--color-primary)]"
            style={{ borderColor: "var(--border-default, #e2e8f0)" }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleFileDrop(e, "logo")}
            onClick={() => logoInputRef.current?.click()}
            role="button"
            aria-label="Upload logo — click or drag and drop"
            tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") logoInputRef.current?.click(); }}
          >
            <div className="text-[0.82rem] font-medium" style={{ color: "var(--text-secondary)" }}>
              Drop your logo here, or click to browse
            </div>
            <div className="text-[0.72rem]" style={{ color: "var(--text-tertiary)" }}>
              PNG or SVG · Max 2 MB
            </div>
            <button type="button" className="btn btn-secondary btn-sm mt-1" onClick={e => { e.stopPropagation(); logoInputRef.current?.click(); }}>
              Upload Logo
            </button>
          </div>
        )}

        <input
          ref={logoInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.svg,.webp,image/*"
          className="hidden"
          aria-hidden="true"
          onChange={e => handleFileInput(e, "logo")}
        />
        <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
          Recommended: 200 × 60 px PNG or SVG. Shown in the sidebar.
        </p>
      </div>

      {/* Visual separator */}
      <hr style={{ borderColor: "var(--border-subtle)" }} />

      {/* ── Favicon ─────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label className="form-label">Favicon</label>

        {faviconPreviewUrl ? (
          /* Preview state */
          <div className="flex items-center gap-4 rounded-lg border p-4" style={{ borderColor: "var(--border-default, #e2e8f0)" }}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <img
                src={faviconPreviewUrl}
                alt="Favicon preview"
                className="h-8 w-8 object-contain rounded border"
                style={{ borderColor: "var(--border-default, #e2e8f0)" }}
              />
              {faviconFile && (
                <span className="text-[0.78rem] truncate min-w-0" style={{ color: "var(--text-secondary)" }}>
                  {faviconFile.name}
                </span>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => faviconInputRef.current?.click()}>
                Change
              </button>
              <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => void handleRemoveFavicon()}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          /* Empty drop zone */
          <div
            className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors hover:border-[var(--color-primary)]"
            style={{ borderColor: "var(--border-default, #e2e8f0)" }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleFileDrop(e, "favicon")}
            onClick={() => faviconInputRef.current?.click()}
            role="button"
            aria-label="Upload favicon — click or drag and drop"
            tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") faviconInputRef.current?.click(); }}
          >
            <div className="text-[0.82rem] font-medium" style={{ color: "var(--text-secondary)" }}>
              Drop your favicon here, or click to browse
            </div>
            <div className="text-[0.72rem]" style={{ color: "var(--text-tertiary)" }}>
              ICO or PNG · Max 256 KB
            </div>
            <button type="button" className="btn btn-secondary btn-sm mt-1" onClick={e => { e.stopPropagation(); faviconInputRef.current?.click(); }}>
              Upload Favicon
            </button>
          </div>
        )}

        <input
          ref={faviconInputRef}
          type="file"
          accept=".png,.ico,.svg,image/*"
          className="hidden"
          aria-hidden="true"
          onChange={e => handleFileInput(e, "favicon")}
        />
        <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
          Recommended: 32 × 32 px ICO or PNG. Shown in the browser tab.
        </p>
      </div>
    </div>
  );
}
