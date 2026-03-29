import type { ButtonHTMLAttributes, ReactNode } from "react";

type AppButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "dangerOutline";

type AppButtonSize = "sm" | "md" | "lg";

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  unstyled?: boolean;
}

const VARIANT_CLASS: Record<AppButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  outline: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-danger",
  dangerOutline: "btn-danger-outline",
};

const SIZE_CLASS: Record<AppButtonSize, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

export function AppButton({
  children,
  className = "",
  variant = "primary",
  size = "md",
  unstyled = false,
  ...props
}: AppButtonProps) {
  const classes = unstyled
    ? className
    : ["btn", VARIANT_CLASS[variant], SIZE_CLASS[size], className]
        .filter(Boolean)
        .join(" ");

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
