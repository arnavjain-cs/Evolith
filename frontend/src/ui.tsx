import { forwardRef } from "react";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { LoaderCircle } from "lucide-react";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
    busy?: boolean;
  }
>(function Button(
  { variant = "secondary", busy, children, className = "", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      {...props}
      className={`button ${variant} ${className}`}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
});
export function Badge({
  children,
  tone = "",
}: PropsWithChildren<{ tone?: string }>) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <div className="empty">
      <div className="empty-glyph" aria-hidden="true">
        ∑
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Metric({
  label,
  value,
  unit = "",
}: {
  label: string;
  value: string | number | null;
  unit?: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>
        {value === null ? "—" : value}
        <small>{value !== null && unit}</small>
      </strong>
    </div>
  );
}
