import { Mail } from "lucide-react";

export function EmailsTab() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: "var(--surface-secondary, #f1f5f9)" }}>
        <Mail size={18} style={{ color: "var(--text-tertiary, #94a3b8)" }} />
      </div>
      <p className="text-[0.9rem] font-semibold" style={{ color: "var(--text-primary, #1e293b)" }}>Email Template Branding</p>
      <p className="text-[0.8rem] max-w-xs" style={{ color: "var(--text-secondary, #64748b)" }}>
        Customise the logo, header colour, and footer text in system notification emails. Ships in Sprint 42.
      </p>
      <span className="badge badge-info text-[0.72rem]">Coming soon</span>
    </div>
  );
}
