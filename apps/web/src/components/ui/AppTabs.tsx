import type { ReactNode } from "react";

export interface AppTab<T extends string = string> {
  key: T;
  label: ReactNode;
  /** Optional count bubble shown inside the tab */
  count?: number;
  disabled?: boolean;
}

interface AppTabsProps<T extends string = string> {
  tabs: AppTab<T>[];
  active: T;
  onChange: (key: T) => void;
  /** "pill" = segmented control (default), "line" = bottom-border underline */
  variant?: "pill" | "line";
  className?: string;
}

export function AppTabs<T extends string = string>({
  tabs,
  active,
  onChange,
  variant = "pill",
  className,
}: AppTabsProps<T>) {
  if (variant === "line") {
    return (
      <div
        className={`flex items-stretch border-b border-[var(--border-subtle)]${className ? ` ${className}` : ""}`}
        role="tablist"
      >
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              disabled={t.disabled}
              onClick={() => !t.disabled && onChange(t.key)}
              style={isActive
                ? { borderBottomColor: "var(--brand-600, #6366f1)", color: "var(--brand-600, #6366f1)" }
                : { borderBottomColor: "transparent", color: "var(--text-secondary, #64748b)" }}
              className={[
                "px-4 py-2.5 text-[0.82rem] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap bg-transparent border-t-0 border-l-0 border-r-0 cursor-pointer flex items-center gap-1.5",
                t.disabled ? "opacity-40 cursor-not-allowed" : "hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="tab-count">{t.count}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // pill (default)
  return (
    <div
      className={`tabs${className ? ` ${className}` : ""}`}
      role="tablist"
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={t.key === active}
          disabled={t.disabled}
          onClick={() => !t.disabled && onChange(t.key)}
          className={[
            "tab",
            t.key === active ? "active" : "",
            t.disabled ? "opacity-40 cursor-not-allowed" : "",
          ].filter(Boolean).join(" ")}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="tab-count">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
