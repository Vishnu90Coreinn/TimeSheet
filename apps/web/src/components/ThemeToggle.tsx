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
      type="button"
      onClick={cycle}
      className="icon-btn"
      title={`Theme: ${current.label} — click to change`}
      aria-label={`Switch theme (current: ${current.label})`}
    >
      <span style={{ fontSize: "1rem", lineHeight: 1 }}>{current.icon}</span>
    </button>
  );
}
