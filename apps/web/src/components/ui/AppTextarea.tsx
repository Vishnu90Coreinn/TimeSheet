import { forwardRef, type TextareaHTMLAttributes } from "react";

export const AppTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AppTextarea({ className = "", ...props }, ref) {
    return <textarea ref={ref} className={`input-field ${className}`.trim()} {...props} />;
  }
);

