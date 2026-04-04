import type { ReactNode } from "react";

export type BadgeVariant = "success" | "error" | "warning" | "neutral" | "info" | "danger";

interface AppBadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function AppBadge({ variant = "neutral", children, className }: AppBadgeProps) {
  return (
    <span className={`badge badge-${variant}${className ? ` ${className}` : ""}`}>
      {children}
    </span>
  );
}
