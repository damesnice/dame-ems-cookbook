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
