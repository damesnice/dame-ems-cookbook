import { COLORS } from "./theme.js";

export function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "'Fraunces', serif",
        fontSize: 15,
        fontWeight: 500,
        letterSpacing: "0.02em",
        padding: "10px 18px 12px",
        background: "transparent",
        border: "none",
        borderBottom: active ? `3px solid ${COLORS.plum}` : "3px solid transparent",
        color: active ? COLORS.ink : COLORS.inkSoft,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export function Button({ children, onClick, variant = "primary", style, type = "button", disabled = false }) {
  const base = {
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.01em",
    padding: "9px 16px",
    borderRadius: 3,
    cursor: disabled ? "default" : "pointer",
    border: "1px solid " + COLORS.ink,
    opacity: disabled ? 0.55 : 1,
  };
  const variants = {
    primary: { background: COLORS.plum, color: "var(--c-onAccent)", border: `1px solid ${COLORS.plum}` },
    ghost: { background: "transparent", color: COLORS.ink, border: `1px solid ${COLORS.line}` },
    danger: { background: "transparent", color: "var(--c-danger)", border: "1px solid var(--c-danger)" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

export function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: COLORS.inkSoft,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}
