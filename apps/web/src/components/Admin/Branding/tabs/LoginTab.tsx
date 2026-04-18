import { Lock } from "lucide-react";
import { AppBadge } from "../../../ui";

export function LoginTab() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: "var(--surface-secondary, #f1f5f9)" }}>
        <Lock size={18} style={{ color: "var(--text-tertiary, #94a3b8)" }} />
      </div>
      <p className="text-[0.9rem] font-semibold" style={{ color: "var(--text-primary, #1e293b)" }}>Login Page Customisation</p>
      <p className="text-[0.8rem] max-w-xs" style={{ color: "var(--text-secondary, #64748b)" }}>
        Customise the background, tagline, and hero image on your login page. Ships in Sprint 42.
      </p>
      <AppBadge variant="info" className="text-[0.72rem]">Coming soon</AppBadge>
    </div>
  );
}
