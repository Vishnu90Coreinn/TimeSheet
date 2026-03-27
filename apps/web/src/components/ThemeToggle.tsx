import { useTheme, type Theme } from "../contexts/ThemeContext";

const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark",  label: "Dark",  icon: "🌙" },
  { value: "system", label: "System", icon: "💻" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  function cycle() {
    const idx = THEMES.findIndex((t) => t.value === theme);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next.value);
  }

  const current = THEMES.find((t) => t.value === theme) ?? THEMES[0];

  return (
    <button
      onClick={cycle}
      title={`Theme: ${current.label} (click to change)`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.3rem",
        background: "none",
        border: "1px solid var(--color-n-200, #e5e7eb)",
        borderRadius: 7,
        padding: "4px 9px",
        cursor: "pointer",
        fontSize: "0.78rem",
        color: "var(--color-text-secondary, #64647a)",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--color-n-50, #f5f5f7)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "none";
      }}
    >
      <span style={{ fontSize: "0.9rem" }}>{current.icon}</span>
    </button>
  );
}
