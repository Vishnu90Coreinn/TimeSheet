import { AppBadge } from "../../../ui";

interface AdvancedTabProps {
  customDomain: string;
  onCustomDomainChange: (v: string) => void;
}

export function AdvancedTab({ customDomain, onCustomDomainChange }: AdvancedTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Custom Domain — live */}
      <div className="flex flex-col gap-1.5">
        <label className="form-label">
          Custom Domain <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
        </label>
        <input
          type="text"
          className="input-field"
          value={customDomain}
          onChange={e => onCustomDomainChange(e.target.value)}
          placeholder="app.yourcompany.com"
          maxLength={255}
        />
        <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
          Leave blank to use the default domain. DNS configuration is outside the app.
        </p>
      </div>

      {/* Custom CSS */}
      <div className="flex flex-col gap-2">
        <label className="form-label mb-0">Custom CSS</label>

        {/* Amber danger warning */}
        <div
          className="flex gap-2.5 rounded-lg border p-3"
          style={{ background: "#fffbeb", borderColor: "#fcd34d" }}
          role="alert"
        >
          <span className="text-base leading-none flex-shrink-0" aria-hidden="true">⚠</span>
          <p className="text-[0.78rem]" style={{ color: "#92400e" }}>
            <strong>Advanced feature</strong> — incorrect CSS can break the application UI. Proceed with caution.
          </p>
        </div>

        <div className="opacity-50 pointer-events-none flex flex-col gap-1.5">
          <textarea
            className="input-field font-mono text-sm resize-none"
            rows={5}
            disabled
            placeholder="/* Override any CSS variable or class here */"
            aria-label="Custom CSS editor — coming soon"
          />
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            For advanced users — changes here can affect the entire UI.
          </p>
        </div>

        <AppBadge variant="info" className="self-start text-[0.68rem]">Coming soon</AppBadge>
      </div>

      {/* Branding Export / Import */}
      <div className="flex flex-col gap-1.5">
        <label className="form-label mb-0">Branding Export / Import</label>
        <p className="text-[0.8rem]" style={{ color: "var(--text-tertiary)" }}>
          Branding import/export — coming soon.
        </p>
      </div>
    </div>
  );
}
