import type { ReactNode } from "react";

interface AppTableShellProps {
  children: ReactNode;
  className?: string;
}

export function AppTableShell({ children, className = "" }: AppTableShellProps) {
  return <div className={`table-wrap mgmt-table-wrap ${className}`.trim()}>{children}</div>;
}

