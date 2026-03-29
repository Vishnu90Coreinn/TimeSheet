import { forwardRef, type SelectHTMLAttributes } from "react";

export const AppSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function AppSelect({ className = "", ...props }, ref) {
    return <select ref={ref} className={`input-field ${className}`.trim()} {...props} />;
  }
);

