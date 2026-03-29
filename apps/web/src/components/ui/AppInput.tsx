import { forwardRef, type InputHTMLAttributes } from "react";

export const AppInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function AppInput({ className = "", ...props }, ref) {
    return <input ref={ref} className={`input-field ${className}`.trim()} {...props} />;
  }
);

