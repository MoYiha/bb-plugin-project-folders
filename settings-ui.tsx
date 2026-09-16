import type { ReactNode } from "react";

/** A titled block of related settings inside a settings section. */
export function SettingsGroup({
  title,
  hint,
  children,
  actions,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="pf-sgroup">
      <header className="pf-sgroup-header">
        <div>
          <h3>{title}</h3>
          {hint && <p className="pf-sgroup-hint">{hint}</p>}
        </div>
        {actions}
      </header>
      <div className="pf-sgroup-body">{children}</div>
    </section>
  );
}

/** One setting: label and explanation on the left, the control on the right. */
export function SettingRow({
  label,
  hint,
  htmlFor,
  children,
  disabled,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className={"pf-srow" + (disabled ? " pf-srow-disabled" : "")}>
      <div className="pf-srow-text">
        <label htmlFor={htmlFor}>{label}</label>
        {hint && <p>{hint}</p>}
      </div>
      <div className="pf-srow-control">{children}</div>
    </div>
  );
}

/** An accessible on/off switch styled like BB's own toggles. */
export function Switch({
  id,
  checked,
  onChange,
  label,
}: {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={"pf-switch" + (checked ? " pf-switch-on" : "")}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}
