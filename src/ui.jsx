// Shared style primitives — split out of App.jsx so Settings.jsx (and any
// future non-App component) can import them without an App.jsx <-> Settings.jsx
// circular import.

// Values point at CSS custom properties rather than hardcoded hex, so a
// whole-app theme (e.g. the dark fall theme) can override every color at
// once via a single [data-theme] CSS rule instead of threading a theme
// object through every component. The actual light/dark values live as
// static CSS in index.html (present from first paint, before React mounts)
// — keep the two in sync if either changes.
export const COLORS = {
  paper: "var(--c-paper)",
  paperDeep: "var(--c-paperDeep)",
  ink: "var(--c-ink)",
  inkSoft: "var(--c-inkSoft)",
  plum: "var(--c-plum)",
  plumSoft: "var(--c-plumSoft)",
  mustard: "var(--c-mustard)",
  moss: "var(--c-moss)",
  line: "var(--c-line)",
  card: "var(--c-card)",
};

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

export const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "'Inter', sans-serif",
  fontSize: 14,
  padding: "9px 10px",
  border: `1px solid ${COLORS.line}`,
  borderRadius: 3,
  background: "var(--c-inputBg)",
  color: COLORS.ink,
};
