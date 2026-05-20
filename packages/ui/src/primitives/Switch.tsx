/**
 * Switch — accessible toggle primitive.
 *
 * Uses a native checkbox with role semantics preserved. The visual track
 * + thumb are CSS; the checkbox remains the accessible control (keyboard
 * Space/Enter toggles, screen readers announce checked state).
 */

import { forwardRef, useId } from "react";
import { switchClass } from "./variants.js";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, className, id, checked, defaultChecked, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const isOn = checked ?? defaultChecked ?? false;

  return (
    <span className={switchClass(isOn, className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        role="switch"
        className="dsg-switch__input"
        checked={checked}
        defaultChecked={defaultChecked}
        {...props}
      />
      <span className="dsg-switch__track" aria-hidden="true">
        <span className="dsg-switch__thumb" />
      </span>
      {label && (
        <label htmlFor={inputId} className="dsg-switch__label">
          {label}
        </label>
      )}
    </span>
  );
});
