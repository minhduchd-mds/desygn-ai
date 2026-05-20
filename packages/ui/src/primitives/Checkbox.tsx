/**
 * Checkbox — accessible checkbox primitive.
 *
 * Wraps a native <input type="checkbox"> (full keyboard + AT support)
 * with a styled label. The native input stays in the DOM (visually
 * styled, not replaced) so screen readers and form submission work.
 */

import { forwardRef, useId } from "react";
import { checkboxClass } from "./variants.js";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <span className="dsg-checkbox-wrap">
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={checkboxClass(className)}
        {...props}
      />
      {label && (
        <label htmlFor={inputId} className="dsg-checkbox__label">
          {label}
        </label>
      )}
    </span>
  );
});
