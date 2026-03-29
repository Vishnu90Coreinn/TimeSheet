const MAX_APP_NAME = 40;

interface IdentityTabProps {
  appName: string;
  onAppNameChange: (v: string) => void;
}

export function IdentityTab({ appName, onAppNameChange }: IdentityTabProps) {
  const remaining = MAX_APP_NAME - appName.length;
  const isNearLimit = remaining <= 10;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="form-label" htmlFor="branding-app-name">App Name</label>
        <input
          id="branding-app-name"
          type="text"
          className="input-field"
          value={appName}
          onChange={e => onAppNameChange(e.target.value)}
          maxLength={MAX_APP_NAME}
          required
          placeholder="Timesheet"
          aria-describedby="branding-app-name-hint branding-app-name-counter"
        />
        <div className="flex items-start justify-between gap-2 mt-0.5">
          <p id="branding-app-name-hint" className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Displayed in the sidebar, browser tab, and login page.
          </p>
          <p
            id="branding-app-name-counter"
            className="text-xs flex-shrink-0"
            style={{ color: isNearLimit ? "var(--danger, #dc2626)" : "var(--text-tertiary)" }}
            aria-live="polite"
          >
            {appName.length}/{MAX_APP_NAME}
          </p>
        </div>
      </div>
    </div>
  );
}
