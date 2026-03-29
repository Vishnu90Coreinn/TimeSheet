import { forwardRef, type InputHTMLAttributes } from "react";

export const AppCheckbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function AppCheckbox({ className = "", ...props }, ref) {
    return <input ref={ref} type="checkbox" className={`w-4 h-4 [accent-color:var(--brand-600)] ${className}`.trim()} {...props} />;
  }
);

