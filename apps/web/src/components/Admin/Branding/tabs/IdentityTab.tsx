interface IdentityTabProps {
  appName: string;
  onAppNameChange: (v: string) => void;
}

export function IdentityTab({ appName, onAppNameChange }: IdentityTabProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="form-group">
        <label className="form-label">App Name</label>
        <input
          type="text"
          className="form-input"
          value={appName}
          onChange={e => onAppNameChange(e.target.value)}
          maxLength={100}
          required
          placeholder="TimeSheet"
        />
        <p className="form-hint">Displayed in the sidebar, browser tab, and login page.</p>
      </div>
    </div>
  );
}
