import type { ButtonHTMLAttributes, ReactNode } from "react";

type AppIconButtonTone = "default" | "edit" | "danger" | "success";

interface AppIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  tone?: AppIconButtonTone;
}

const TONE_CLASS: Record<AppIconButtonTone, string> = {
  default: "",
  edit: "mgmt-icon-action-edit",
  danger: "mgmt-icon-action-danger",
  success: "mgmt-icon-action-success",
};

export function AppIconButton({
  children,
  className = "",
  tone = "default",
  ...props
}: AppIconButtonProps) {
  const classes = ["mgmt-icon-action", TONE_CLASS[tone], className].filter(Boolean).join(" ");
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

