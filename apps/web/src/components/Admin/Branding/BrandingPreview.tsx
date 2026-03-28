/**
 * BrandingPreview.tsx — Live preview panel with Sidebar / Dashboard / Login screen switcher.
 * Uses inline styles with the live primaryColor — does NOT call applyBrandColor()
 * (that would mutate the real app's CSS variables before saving).
 */
import { useState } from "react";

type PreviewScreen = "sidebar" | "dashboard" | "login";

interface BrandingPreviewProps {
  appName: string;
  primaryColor: string;
  logoPreviewUrl: string | null;
}

export function BrandingPreview({ appName, primaryColor, logoPreviewUrl }: BrandingPreviewProps) {
  const [screen, setScreen] = useState<PreviewScreen>("sidebar");

  const monogram = appName.charAt(0).toUpperCase() || "T";
  const btnBase = "px-3 py-1 rounded-full text-[0.72rem] font-medium transition-colors cursor-pointer border-0";
  const btnActive = { background: primaryColor, color: "#ffffff" };
  const btnInactive = { background: "var(--surface-secondary, #f1f5f9)", color: "var(--text-secondary, #64748b)" };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Screen switcher */}
      <div className="flex gap-1">
        {(["sidebar", "dashboard", "login"] as PreviewScreen[]).map(s => (
          <button
            key={s}
            className={btnBase}
            style={screen === s ? btnActive : btnInactive}
            onClick={() => setScreen(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Preview frame */}
      <div className="rounded-lg overflow-hidden border border-[var(--border-default)] flex-1" style={{ minHeight: 280 }}>
        {screen === "sidebar" && <SidebarScreen appName={appName} primaryColor={primaryColor} logoUrl={logoPreviewUrl} monogram={monogram} />}
        {screen === "dashboard" && <DashboardScreen primaryColor={primaryColor} />}
        {screen === "login" && <LoginScreen appName={appName} primaryColor={primaryColor} logoUrl={logoPreviewUrl} monogram={monogram} />}
      </div>

      <p className="text-[0.72rem] text-[var(--text-tertiary)]">
        Preview updates live. Colour + logo applied on Save.
      </p>
    </div>
  );
}

function SidebarScreen({ appName, primaryColor, logoUrl, monogram }: { appName: string; primaryColor: string; logoUrl: string | null; monogram: string }) {
  const navItems = ["Dashboard", "Timesheets", "Leave", "Reports"];
  const adminItems = ["Users", "Branding"];
  return (
    <div className="flex h-full" style={{ minHeight: 280 }}>
      {/* Sidebar */}
      <div className="w-44 flex flex-col h-full p-2.5" style={{ background: "#1e1b4b" }}>
        <div className="flex items-center gap-2 px-2 py-2.5 mb-2">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-6 w-auto max-w-[100px] object-contain" />
          ) : (
            <>
              <div className="h-6 w-6 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: primaryColor }}>{monogram}</div>
              <span className="text-white font-semibold text-[0.8rem] truncate">{appName}</span>
            </>
          )}
        </div>
        <p className="text-[0.62rem] px-2 mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Main</p>
        {navItems.map((item, i) => (
          <div
            key={item}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md mb-0.5 text-[0.78rem]"
            style={i === 0 ? { background: `${primaryColor}33`, color: primaryColor } : { color: "rgba(255,255,255,0.55)" }}
          >
            <div className="h-3 w-3 rounded bg-current opacity-60 flex-shrink-0" />{item}
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-white/10">
          <p className="text-[0.62rem] px-2 mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Admin</p>
          {adminItems.map(item => (
            <div key={item} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md mb-0.5 text-[0.78rem]" style={{ color: "rgba(255,255,255,0.55)" }}>
              <div className="h-3 w-3 rounded bg-current opacity-60 flex-shrink-0" />{item}
            </div>
          ))}
        </div>
      </div>
      {/* Main area */}
      <div className="flex-1 p-4" style={{ background: "var(--surface-primary, #f8fafc)" }}>
        <div className="h-4 w-28 rounded mb-3" style={{ background: "var(--border-default, #e2e8f0)" }} />
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[1, 2].map(i => (
            <div key={i} className="rounded-lg p-3 bg-white border" style={{ borderColor: "var(--border-default, #e2e8f0)" }}>
              <div className="h-2.5 w-12 rounded mb-2" style={{ background: "var(--border-default, #e2e8f0)" }} />
              <div className="h-5 w-10 rounded text-xs font-bold flex items-center justify-center text-white" style={{ background: primaryColor }}>{i * 12}</div>
            </div>
          ))}
        </div>
        <div className="h-7 w-24 rounded flex items-center justify-center text-white text-[0.72rem] font-semibold" style={{ background: primaryColor }}>Submit</div>
      </div>
    </div>
  );
}

function DashboardScreen({ primaryColor }: { primaryColor: string }) {
  return (
    <div className="p-4 h-full" style={{ background: "var(--surface-primary, #f8fafc)", minHeight: 280 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[0.82rem] font-bold" style={{ color: "var(--text-primary, #1e293b)" }}>Good morning, Admin</p>
          <p className="text-[0.72rem]" style={{ color: "var(--text-tertiary, #94a3b8)" }}>Preview — branding applied</p>
        </div>
        <div className="rounded-lg px-3 py-1.5 text-white text-[0.72rem] font-semibold" style={{ background: primaryColor }}>Clock In</div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[["32h", "This week"], ["8d", "Leave"], ["3", "Pending"]].map(([val, label]) => (
          <div key={label} className="bg-white rounded-lg p-2.5 border" style={{ borderColor: "var(--border-default, #e2e8f0)" }}>
            <div className="w-5 h-5 rounded mb-1.5 flex items-center justify-center" style={{ background: `${primaryColor}1a` }}>
              <div className="w-2.5 h-2.5 rounded" style={{ background: primaryColor }} />
            </div>
            <p className="text-[0.85rem] font-bold" style={{ color: primaryColor }}>{val}</p>
            <p className="text-[0.68rem]" style={{ color: "var(--text-tertiary, #94a3b8)" }}>{label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg p-3 border" style={{ borderColor: "var(--border-default, #e2e8f0)" }}>
        <div className="flex justify-between mb-2">
          <p className="text-[0.75rem] font-semibold" style={{ color: "var(--text-primary, #1e293b)" }}>Weekly Progress</p>
          <p className="text-[0.72rem] font-semibold" style={{ color: primaryColor }}>32 / 40h</p>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-default, #e2e8f0)" }}>
          <div className="h-full w-4/5 rounded-full" style={{ background: primaryColor }} />
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ appName, primaryColor, logoUrl, monogram }: { appName: string; primaryColor: string; logoUrl: string | null; monogram: string }) {
  return (
    <div className="flex items-center justify-center h-full p-4" style={{ background: "var(--surface-sunken, #f1f5f9)", minHeight: 280 }}>
      <div className="bg-white rounded-xl p-6 w-full max-w-[200px] border shadow-sm" style={{ borderColor: "var(--border-default, #e2e8f0)" }}>
        <div className="flex flex-col items-center mb-4">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-8 w-auto max-w-[120px] object-contain mb-1" />
          ) : (
            <div className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-base mb-1" style={{ background: primaryColor }}>{monogram}</div>
          )}
          <p className="text-[0.8rem] font-bold" style={{ color: "var(--text-primary, #1e293b)" }}>{appName}</p>
          <p className="text-[0.68rem]" style={{ color: "var(--text-tertiary, #94a3b8)" }}>Sign in to your account</p>
        </div>
        <div className="h-7 rounded-md mb-2 border" style={{ background: "var(--surface-secondary, #f8fafc)", borderColor: "var(--border-default, #e2e8f0)" }} />
        <div className="h-7 rounded-md mb-3 border" style={{ background: "var(--surface-secondary, #f8fafc)", borderColor: "var(--border-default, #e2e8f0)" }} />
        <div className="h-8 rounded-md flex items-center justify-center text-white text-[0.78rem] font-semibold" style={{ background: primaryColor }}>Sign In</div>
      </div>
    </div>
  );
}
