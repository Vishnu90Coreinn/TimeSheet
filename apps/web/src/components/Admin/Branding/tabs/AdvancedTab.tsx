interface AdvancedTabProps {
  customDomain: string;
  onCustomDomainChange: (v: string) => void;
}

export function AdvancedTab({ customDomain, onCustomDomainChange }: AdvancedTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Custom Domain — live in Sprint 40 */}
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
        <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Leave blank to use the default domain. DNS configuration is outside the app.</p>
      </div>

      {/* Custom CSS — Sprint 41 stub */}
      <div className="flex flex-col gap-1.5 opacity-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <label className="form-label mb-0">Custom CSS</label>
          <span className="badge badge-info text-[0.68rem]">Coming in Sprint 41</span>
        </div>
        <textarea
          className="input-field font-mono text-sm resize-none"
          rows={5}
          disabled
          placeholder="/* Override any CSS variable or class here */"
        />
        <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>For advanced users — changes here can break the UI.</p>
      </div>

      {/* JSON Export / Import — Sprint 41 stub */}
      <div className="flex flex-col gap-1.5 opacity-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <label className="form-label mb-0">Branding Export / Import</label>
          <span className="badge badge-info text-[0.68rem]">Coming in Sprint 41</span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary btn-sm" disabled>Export JSON</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled>Import JSON</button>
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Export your full branding config as JSON, or import one from another workspace.</p>
      </div>
    </div>
  );
}
