/**
 * ShortcutsPanel.tsx — keyboard shortcuts reference (triggered by ?)
 */
interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "⌘K / Ctrl+K", desc: "Open command palette",       global: true },
  { key: "?",             desc: "Show keyboard shortcuts",    global: true },
  { key: "Esc",           desc: "Close overlay / palette",   global: true },
  { key: "N",             desc: "New timesheet entry",        view: "Timesheets" },
  { key: "S",             desc: "Submit current week",        view: "Timesheets" },
  { key: "A",             desc: "Approve selected timesheets",view: "Approvals" },
  { key: "/",             desc: "Focus search",               global: true },
  { key: "↑ / ↓",         desc: "Navigate palette results",   view: "Palette" },
  { key: "↵",             desc: "Execute selected command",   view: "Palette" },
];

export function ShortcutsPanel({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--color-n-0, #fff)",
        borderRadius: 14,
        padding: "28px 32px",
        width: "100%",
        maxWidth: 480,
        boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Keyboard Shortcuts</span>
          <button
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#6b7280", padding: "2px 6px" }}
            onClick={onClose}
            aria-label="Close"
          >✕</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {SHORTCUTS.map(s => (
              <tr key={s.key} style={{ borderBottom: "1px solid var(--color-n-100, #f0f0f0)" }}>
                <td style={{ padding: "8px 0" }}>
                  <kbd style={{
                    background: "var(--color-n-100, #f0f0f0)",
                    borderRadius: 5,
                    padding: "2px 8px",
                    fontSize: "0.80rem",
                    fontFamily: "inherit",
                    color: "#374151",
                  }}>{s.key}</kbd>
                </td>
                <td style={{ padding: "8px 0 8px 16px", fontSize: "0.88rem", color: "var(--color-text, #111)" }}>
                  {s.desc}
                </td>
                <td style={{ padding: "8px 0", textAlign: "right", fontSize: "0.72rem", color: "#9ca3af" }}>
                  {s.global ? "Global" : s.view}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
