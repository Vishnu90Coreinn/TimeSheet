interface IdentityTabProps {
  appName: string;
  onAppNameChange: (v: string) => void;
}

export function IdentityTab({ appName, onAppNameChange }: IdentityTabProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="form-label">App Name</label>
        <input
          type="text"
          className="input-field"
          value={appName}
          onChange={e => onAppNameChange(e.target.value)}
          maxLength={100}
          required
          placeholder="TimeSheet"
        />
        <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Displayed in the sidebar, browser tab, and login page.</p>
      </div>
    </div>
  );
}
