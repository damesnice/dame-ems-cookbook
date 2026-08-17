import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = {
  paper: "#EFE9D8",
  paperDeep: "#E5DEC8",
  ink: "#24291F",
  inkSoft: "#5B5A4D",
  plum: "#6B3557",
  plumSoft: "#8A5473",
  mustard: "#C79A3D",
  moss: "#4C6B4C",
  line: "#D2C9AE",
  card: "#F7F3E6",
};

const FONTS_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;1,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');`;

const COVER_LOGO = "/cover.png";

const CATEGORIES = ["Main", "Dinner", "Side", "Baking", "Sauce & ferment", "Breakfast", "Dessert", "Other"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function roundAmt(n) {
  if (!isFinite(n)) return 0;
  if (Math.abs(n - Math.round(n)) < 0.01) return Math.round(n);
  return Math.round(n * 100) / 100;
}

// Steps are often typed or pasted already numbered ("1. Heat a pan...");
// the step list renders its own numbers, so strip a leading "1." / "1)"
// to avoid showing it twice.
function stripLeadingNumber(s) {
  return s.replace(/^\s*\d+[.)]\s*/, "");
}

function findGen(family, genId) {
  return family.generations.find((g) => g.id === genId);
}

function latestKeeper(family) {
  const keepers = family.generations.filter((g) => g.isKeeper);
  const pool = keepers.length ? keepers : family.generations;
  return pool[pool.length - 1];
}

// ---------- persistence ----------
// The shelf is shared: recipes live in a server-side store (via /api/families) so
// everyone who opens the app sees the same collection. localStorage is kept only
// as an offline cache — a fast first paint and a fallback when the network is down.

const STORAGE_KEY = "dame-ems-cookbook:families";

function loadCachedFamilies() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheFamilies(families) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(families));
  } catch {
    // best-effort cache; ignore quota/availability errors
  }
}

async function fetchFamilies() {
  const res = await fetch("/api/families");
  if (!res.ok) throw new Error("Failed to load recipes");
  return res.json();
}

async function pushFamilies(families) {
  const res = await fetch("/api/families", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(families),
  });
  if (!res.ok) throw new Error("Failed to save recipes");
}

const MEALPLAN_STORAGE_KEY = "dame-ems-cookbook:mealplan";

function loadCachedMealPlan() {
  try {
    const raw = localStorage.getItem(MEALPLAN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheMealPlan(mealPlan) {
  try {
    localStorage.setItem(MEALPLAN_STORAGE_KEY, JSON.stringify(mealPlan));
  } catch {
    // best-effort cache; ignore quota/availability errors
  }
}

async function fetchMealPlan() {
  const res = await fetch("/api/mealplan");
  if (!res.ok) throw new Error("Failed to load meal plan");
  return res.json();
}

async function pushMealPlan(mealPlan) {
  const res = await fetch("/api/mealplan", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mealPlan),
  });
  if (!res.ok) throw new Error("Failed to save meal plan");
}

const PANTRY_STORAGE_KEY = "dame-ems-cookbook:pantry";

function loadCachedPantry() {
  try {
    const raw = localStorage.getItem(PANTRY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cachePantry(pantry) {
  try {
    localStorage.setItem(PANTRY_STORAGE_KEY, JSON.stringify(pantry));
  } catch {
    // best-effort cache; ignore quota/availability errors
  }
}

async function fetchPantry() {
  const res = await fetch("/api/pantry");
  if (!res.ok) throw new Error("Failed to load pantry");
  return res.json();
}

async function pushPantry(pantry) {
  const res = await fetch("/api/pantry", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pantry),
  });
  if (!res.ok) throw new Error("Failed to save pantry");
}

// ---------- macro lookups (free, keyless) ----------

async function lookupNutrition(name) {
  const res = await fetch(`/api/lookup-nutrition?name=${encodeURIComponent(name)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Lookup failed");
  return data;
}

async function lookupBarcode(code) {
  const res = await fetch(`/api/lookup-barcode?code=${encodeURIComponent(code)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Lookup failed");
  return data;
}

// ---------- auth ----------

async function checkSession() {
  const res = await fetch("/api/login");
  if (!res.ok) return false;
  const data = await res.json();
  return !!data.authed;
}

async function login(username, password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't log in");
  return true;
}

async function logout() {
  await fetch("/api/login", { method: "DELETE" });
}

// ---------- shared UI bits ----------

function Tab({ label, active, onClick }) {
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

function Button({ children, onClick, variant = "primary", style, type = "button", disabled = false }) {
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
    primary: { background: COLORS.plum, color: "#F7F1EA", border: `1px solid ${COLORS.plum}` },
    ghost: { background: "transparent", color: COLORS.ink, border: `1px solid ${COLORS.line}` },
    danger: { background: "transparent", color: "#8C3B2E", border: "1px solid #8C3B2E" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

function Field({ label, children }) {
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

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "'Inter', sans-serif",
  fontSize: 14,
  padding: "9px 10px",
  border: `1px solid ${COLORS.line}`,
  borderRadius: 3,
  background: "#FFFDF8",
  color: COLORS.ink,
};

function Stars({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={() => onChange && onChange(n)}
          style={{
            cursor: onChange ? "pointer" : "default",
            fontSize: 18,
            color: n <= value ? COLORS.mustard : COLORS.line,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function JarBadge({ isKeeper }) {
  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        fontWeight: 500,
        padding: "2px 7px",
        borderRadius: 20,
        background: isKeeper ? "#E4EBE1" : "#EFEAD8",
        color: isKeeper ? COLORS.moss : COLORS.inkSoft,
        border: `1px solid ${isKeeper ? COLORS.moss : COLORS.line}`,
      }}
    >
      {isKeeper ? "keeper" : "note"}
    </span>
  );
}

// ---------- Macros ----------

function emptyMacroFields() {
  return { calories: "", protein: "", carbs: "", fat: "" };
}

function macrosToFields(macros) {
  if (!macros) return emptyMacroFields();
  return {
    calories: macros.calories ?? "",
    protein: macros.protein ?? "",
    carbs: macros.carbs ?? "",
    fat: macros.fat ?? "",
  };
}

// Empty fields save as null (no macro data) rather than a record full of
// zeros — a dish with genuinely 0g fat looks identical to "never entered"
// otherwise, and null is what tells everything else there's nothing to show.
function fieldsToMacros(fields) {
  const calories = parseFloat(fields.calories) || 0;
  const protein = parseFloat(fields.protein) || 0;
  const carbs = parseFloat(fields.carbs) || 0;
  const fat = parseFloat(fields.fat) || 0;
  if (!calories && !protein && !carbs && !fat) return null;
  return { calories, protein, carbs, fat };
}

function formatMacroLine(macros) {
  if (!macros) return "";
  const parts = [];
  if (macros.calories) parts.push(`${Math.round(macros.calories)} cal`);
  if (macros.protein) parts.push(`${Math.round(macros.protein)}g protein`);
  if (macros.carbs) parts.push(`${Math.round(macros.carbs)}g carbs`);
  if (macros.fat) parts.push(`${Math.round(macros.fat)}g fat`);
  return parts.join(" · ");
}

// Case-insensitive lookup across pantry items and shelf recipes, so a meal
// plan chip named "asparagus" or "Sunday ragù" resolves to whichever has
// macro data, regardless of typed capitalization.
function buildMacroIndex(pantry, families) {
  const index = {};
  Object.entries(pantry?.macros || {}).forEach(([name, m]) => {
    if (m) index[name.toLowerCase()] = { ...m, label: name };
  });
  families.forEach((f) => {
    const gen = latestKeeper(f);
    if (gen?.macros) index[f.name.toLowerCase()] = { ...gen.macros, label: f.name };
  });
  return index;
}

// Sums macros for everything actually planned on one day (across all 4
// slots, following "eat this all week" links via getEffectiveSlot) —
// items with no macro data just don't contribute, no error.
function computeDayTotals(week, day, macroIndex) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  let any = false;
  MEAL_SLOTS.forEach((slot) => {
    const { value } = getEffectiveSlot(week, day, slot);
    value.items.forEach((item) => {
      const m = macroIndex[item.toLowerCase()];
      if (!m) return;
      any = true;
      totals.calories += m.calories || 0;
      totals.protein += m.protein || 0;
      totals.carbs += m.carbs || 0;
      totals.fat += m.fat || 0;
    });
  });
  return any ? totals : null;
}

const MACRO_FIELD_DEFS = [
  ["calories", "Calories"],
  ["protein", "Protein (g)"],
  ["carbs", "Carbs (g)"],
  ["fat", "Fat (g)"],
];

function MacroFields({ fields, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
      {MACRO_FIELD_DEFS.map(([key, label]) => (
        <label key={key} style={{ display: "block" }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.inkSoft, marginBottom: 3 }}>
            {label}
          </div>
          <input
            type="number"
            min="0"
            style={{ ...inputStyle, fontSize: 12, padding: "6px 7px" }}
            value={fields[key]}
            onChange={(e) => onChange({ ...fields, [key]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
}

// Inline macro editor for one pantry item: manual fields plus an optional
// free USDA lookup by the item's own name. Used inside PantryManager.
function MacroEditor({ itemName, macros, onSave, onCancel }) {
  const [fields, setFields] = useState(macrosToFields(macros));
  const [serving, setServing] = useState(macros?.serving || "100g");
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState("");

  async function handleLookup() {
    setLooking(true);
    setError("");
    try {
      const result = await lookupNutrition(itemName);
      setFields({ calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat });
      setServing(result.serving || "100g");
    } catch (err) {
      setError(err.message || "Lookup failed");
    } finally {
      setLooking(false);
    }
  }

  function handleSave() {
    const parsed = fieldsToMacros(fields);
    onSave(parsed ? { ...parsed, serving: serving.trim() || "100g" } : null);
  }

  return (
    <div style={{ marginTop: 8, padding: "10px 12px", background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <input
          style={{ ...inputStyle, fontSize: 11.5, padding: "5px 7px", width: 110 }}
          placeholder="serving, e.g. 100g"
          value={serving}
          onChange={(e) => setServing(e.target.value)}
        />
        <Button variant="ghost" onClick={handleLookup} disabled={looking} style={{ fontSize: 11, padding: "5px 9px" }}>
          {looking ? "Looking up…" : "🔍 look up"}
        </Button>
      </div>
      <MacroFields fields={fields} onChange={setFields} />
      {error && <div style={{ color: "#8C3B2E", fontFamily: "'Inter', sans-serif", fontSize: 11, marginTop: 6 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Button onClick={handleSave} style={{ fontSize: 11, padding: "5px 10px" }}>Save</Button>
        <Button variant="ghost" onClick={onCancel} style={{ fontSize: 11, padding: "5px 10px" }}>Cancel</Button>
      </div>
    </div>
  );
}

// Camera-based barcode scanner (html5-qrcode). Loaded lazily so the
// scanning library only downloads when someone actually opens this.
function BarcodeScannerModal({ onDetected, onClose }) {
  const regionId = "barcode-scanner-region";
  const scannerRef = useRef(null);
  const detectedRef = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    import("html5-qrcode").then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(regionId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
        ],
      });
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decodedText) => {
            if (detectedRef.current) return;
            detectedRef.current = true;
            onDetected(decodedText);
          },
          () => {
            // per-frame "nothing found yet" — not an error, ignore
          }
        )
        .catch((err) => setError(err?.message || "Couldn't start the camera"));
    });

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, [onDetected]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(36,41,31,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: COLORS.paper, borderRadius: 6, padding: 20, maxWidth: 420, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 500, color: COLORS.ink }}>Scan a barcode</span>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: COLORS.inkSoft, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 }}>
            ×
          </button>
        </div>
        <div id={regionId} style={{ width: "100%", borderRadius: 4, overflow: "hidden" }} />
        {error && (
          <div style={{ color: "#8C3B2E", fontFamily: "'Inter', sans-serif", fontSize: 12.5, marginTop: 10 }}>{error}</div>
        )}
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.inkSoft, marginTop: 10, marginBottom: 0 }}>
          Point your camera at a product&rsquo;s barcode.
        </p>
      </div>
    </div>
  );
}

// ---------- Shelf ----------

function Shelf({ families, onOpen, onNew, onRecategorize }) {
  const [filter, setFilter] = useState("All");
  const [dragOverCategory, setDragOverCategory] = useState(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = families.filter((f) => {
    if (filter !== "All" && f.category !== filter) return false;
    if (!q) return true;
    if (f.name.toLowerCase().includes(q)) return true;
    return latestKeeper(f).ingredients.some((i) => i.name.toLowerCase().includes(q));
  });

  if (families.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontStyle: "italic", color: COLORS.ink, marginBottom: 10 }}>
          The shelf is empty.
        </div>
        <p style={{ color: COLORS.inkSoft, fontFamily: "'Inter', sans-serif", fontSize: 14, marginBottom: 22 }}>
          Add your first recipe — you can come back and log changes to it any time you cook it again.
        </p>
        <Button onClick={onNew}>Add a recipe</Button>
      </div>
    );
  }

  return (
    <div>
      <input
        style={{ ...inputStyle, maxWidth: 320, marginBottom: 16 }}
        placeholder="Search recipes or ingredients…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            onDragOver={(e) => {
              if (c === "All") return;
              e.preventDefault();
              setDragOverCategory(c);
            }}
            onDragLeave={() => setDragOverCategory((cur) => (cur === c ? null : cur))}
            onDrop={(e) => {
              if (c === "All") return;
              e.preventDefault();
              const familyId = e.dataTransfer.getData("text/plain");
              if (familyId) onRecategorize(familyId, c);
              setDragOverCategory(null);
            }}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 500,
              padding: "6px 12px",
              borderRadius: 20,
              border: `1px solid ${filter === c || dragOverCategory === c ? COLORS.plum : COLORS.line}`,
              background: filter === c ? COLORS.plum : dragOverCategory === c ? COLORS.line : "transparent",
              color: filter === c ? "#F7F1EA" : COLORS.inkSoft,
              cursor: "pointer",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p style={{ fontFamily: "'Inter', sans-serif", color: COLORS.inkSoft, fontSize: 14 }}>
          {q ? "No recipes match that search." : "Nothing on the shelf in this category yet."}
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {shown.map((f) => {
            const gen = latestKeeper(f);
            return (
              <div
                key={f.id}
                onClick={() => onOpen(f.id, gen.id)}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", f.id)}
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 4,
                  padding: "18px 18px 16px",
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 20,
                    width: 34,
                    height: 10,
                    background: COLORS.mustard,
                    borderRadius: "0 0 4px 4px",
                  }}
                />
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: COLORS.plum,
                    marginTop: 8,
                    marginBottom: 6,
                  }}
                >
                  {f.category}
                </div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 500, color: COLORS.ink, marginBottom: 8 }}>
                  {f.name}
                </div>
                <Stars value={gen.rating || 0} />
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: `1px solid ${COLORS.line}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: COLORS.inkSoft,
                  }}
                >
                  <span>{f.generations.length > 1 ? `${f.generations.length} versions` : ""}</span>
                  <span>{fmtDate(gen.cookedDate)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Ingredient picker (shared by New recipe + Log a cook) ----------

function combinedIngredientNames(pantry, families) {
  const set = new Set();
  (pantry?.categories || []).forEach((c) => c.items.forEach((it) => set.add(it)));
  families.forEach((f) =>
    f.generations.forEach((g) => g.ingredients.forEach((i) => i.name && set.add(i.name)))
  );
  return [...set].sort((a, b) => a.localeCompare(b));
}

function IngredientPicker({ pantry, onPick }) {
  const categories = pantry?.categories || [];
  const [activeCat, setActiveCat] = useState(categories[0]?.name || null);
  const [search, setSearch] = useState("");

  if (categories.length === 0) return null;

  const searching = search.trim().length > 0;
  const q = search.trim().toLowerCase();
  const visibleItems = searching
    ? categories.flatMap((c) => c.items.filter((it) => it.toLowerCase().includes(q)))
    : categories.find((c) => c.name === activeCat)?.items || [];

  return (
    <div style={{ marginBottom: 10, padding: "10px 12px", background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.inkSoft }}>
          Quick add from pantry
        </span>
        <input
          style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 150 }}
          placeholder="search pantry…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {!searching && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {categories.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setActiveCat(c.name)}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
                fontWeight: 500,
                padding: "4px 10px",
                borderRadius: 20,
                border: `1px solid ${activeCat === c.name ? COLORS.plum : COLORS.line}`,
                background: activeCat === c.name ? COLORS.plum : "transparent",
                color: activeCat === c.name ? "#F7F1EA" : COLORS.inkSoft,
                cursor: "pointer",
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {visibleItems.length === 0 ? (
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.inkSoft }}>No matches.</span>
        ) : (
          visibleItems.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onPick(item)}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                padding: "5px 10px",
                borderRadius: 4,
                border: `1px solid ${COLORS.line}`,
                background: "#FFFDF8",
                color: COLORS.ink,
                cursor: "pointer",
              }}
            >
              + {item}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ---------- New culture (create family + generation 0) ----------

function NewCulture({ onCreate, onCancel, pantry, families }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [servings, setServings] = useState(4);
  const [ingredients, setIngredients] = useState([{ id: uid(), name: "", amount: "", unit: "" }]);
  const [steps, setSteps] = useState("");
  const [notes, setNotes] = useState("");
  const [macroFields, setMacroFields] = useState(emptyMacroFields());

  function updateIng(id, field, val) {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: val } : i)));
  }
  function addIng() {
    setIngredients((prev) => [...prev, { id: uid(), name: "", amount: "", unit: "" }]);
  }
  function removeIng(id) {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }
  function pickIngredient(itemName) {
    setIngredients((prev) => {
      const last = prev[prev.length - 1];
      if (last && !last.name.trim() && !last.amount && !last.unit) {
        return prev.map((i, idx) => (idx === prev.length - 1 ? { ...i, name: itemName } : i));
      }
      return [...prev, { id: uid(), name: itemName, amount: "", unit: "" }];
    });
  }

  function submit() {
    if (!name.trim()) return;
    const cleanIngredients = ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({ ...i, amount: parseFloat(i.amount) || 0 }));
    const genId = uid();
    const family = {
      id: uid(),
      name: name.trim(),
      category,
      createdDate: todayISO(),
      generations: [
        {
          id: genId,
          parentId: null,
          label: "Original",
          servings: parseInt(servings, 10) || 4,
          ingredients: cleanIngredients,
          steps: steps.split("\n").map((s) => stripLeadingNumber(s.trim())).filter(Boolean),
          notes: notes.trim(),
          macros: fieldsToMacros(macroFields),
          rating: 0,
          isKeeper: true,
          cookedDate: todayISO(),
        },
      ],
    };
    onCreate(family, genId);
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 500, marginBottom: 4 }}>Add a recipe</h2>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.inkSoft, marginBottom: 22 }}>
        You can log changes later, any time you cook it differently.
      </p>

      <Field label="Name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunday ragù" />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Category">
          <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Serves">
          <input type="number" min="1" style={inputStyle} value={servings} onChange={(e) => setServings(e.target.value)} />
        </Field>
      </div>

      <Field label="Ingredients">
        <IngredientPicker pantry={pantry} onPick={pickIngredient} />
        <datalist id="pantry-ingredient-names">
          {combinedIngredientNames(pantry, families).map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {ingredients.map((ing) => (
          <div key={ing.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 28px", gap: 6, marginBottom: 6 }}>
            <input style={inputStyle} list="pantry-ingredient-names" placeholder="onion, diced" value={ing.name} onChange={(e) => updateIng(ing.id, "name", e.target.value)} />
            <input style={inputStyle} placeholder="1" value={ing.amount} onChange={(e) => updateIng(ing.id, "amount", e.target.value)} />
            <input style={inputStyle} placeholder="cup" value={ing.unit} onChange={(e) => updateIng(ing.id, "unit", e.target.value)} />
            <button onClick={() => removeIng(ing.id)} style={{ border: "none", background: "transparent", color: COLORS.inkSoft, cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        ))}
        <button
          onClick={addIng}
          style={{ border: "none", background: "transparent", color: COLORS.plum, cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif", fontWeight: 600, padding: "4px 0" }}
        >
          + add ingredient
        </button>
      </Field>

      <Field label="Steps (one per line)">
        <textarea style={{ ...inputStyle, minHeight: 110, resize: "vertical", fontFamily: "'Inter', sans-serif" }} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={"Soften onion and garlic in olive oil.\nAdd tomato and simmer 40 minutes."} />
      </Field>

      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: "'Inter', sans-serif" }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Where this came from, what makes it work." />
      </Field>

      <Field label="Macros per serving (optional)">
        <MacroFields fields={macroFields} onChange={setMacroFields} />
      </Field>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <Button onClick={submit}>Save recipe</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ---------- Recipe detail ----------

function RecipeDetail({ family, genId, onViewTree, onLogCook, onBack, onRateGen }) {
  const gen = findGen(family, genId) || latestKeeper(family);
  const [servings, setServings] = useState(gen.servings || 4);

  useEffect(() => {
    setServings(gen.servings || 4);
  }, [gen.id, gen.servings]);

  const mult = servings / (gen.servings || 1);

  return (
    <div>
      <button onClick={onBack} style={{ border: "none", background: "transparent", color: COLORS.inkSoft, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 12, marginBottom: 14, padding: 0 }}>
        ← back to the shelf
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
        <div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: COLORS.plum, marginBottom: 4 }}>
            {family.category}
          </div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 30, fontWeight: 500, margin: 0 }}>{family.name}</h2>
        </div>
        <Stars value={gen.rating || 0} onChange={(r) => onRateGen(gen.id, r)} />
      </div>

      {family.generations.length > 1 && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 15, color: COLORS.inkSoft }}>
            Showing: {gen.label}
          </span>
          <JarBadge isKeeper={gen.isKeeper} />
          <button onClick={onViewTree} style={{ border: `1px solid ${COLORS.line}`, background: "transparent", borderRadius: 20, padding: "3px 11px", fontFamily: "'Inter', sans-serif", fontSize: 11, color: COLORS.inkSoft, cursor: "pointer" }}>
            {family.generations.length} versions — view history
          </button>
        </div>
      )}

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.inkSoft }}>Serves</span>
          <button onClick={() => setServings((s) => Math.max(1, s - 1))} style={{ width: 24, height: 24, border: `1px solid ${COLORS.line}`, background: "transparent", cursor: "pointer", borderRadius: 3 }}>−</button>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, minWidth: 20, textAlign: "center" }}>{servings}</span>
          <button onClick={() => setServings((s) => s + 1)} style={{ width: 24, height: 24, border: `1px solid ${COLORS.line}`, background: "transparent", cursor: "pointer", borderRadius: 3 }}>+</button>
        </div>

        {gen.macros && (
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 18 }}>
            Per serving: {formatMacroLine(gen.macros)}
          </div>
        )}

        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.inkSoft, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${COLORS.line}` }}>
          Ingredients
        </div>
        {gen.ingredients.length === 0 ? (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.inkSoft }}>None recorded.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, maxWidth: 480 }}>
            {gen.ingredients.map((ing) => (
              <li key={ing.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: `1px solid ${COLORS.line}`, fontFamily: "'Inter', sans-serif", fontSize: 13.5 }}>
                <span>{ing.name}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: COLORS.inkSoft, whiteSpace: "nowrap" }}>
                  {ing.amount ? `${roundAmt(ing.amount * mult)} ${ing.unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.inkSoft, marginTop: 28, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${COLORS.line}` }}>
          Steps
        </div>
        {gen.steps.length === 0 ? (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.inkSoft }}>None recorded.</p>
        ) : (
          <ol style={{ paddingLeft: 20, margin: 0, maxWidth: 640 }}>
            {gen.steps.map((s, idx) => (
              <li key={idx} style={{ fontFamily: "'Inter', sans-serif", fontSize: 14.5, lineHeight: 1.7, color: COLORS.ink, marginBottom: 6 }}>
                {stripLeadingNumber(s)}
              </li>
            ))}
          </ol>
        )}

        {gen.notes && (
          <div style={{ marginTop: 18, padding: "12px 14px", background: COLORS.card, borderLeft: `3px solid ${COLORS.mustard}`, borderRadius: "0 3px 3px 0", maxWidth: 640 }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.inkSoft, marginBottom: 4 }}>Notes from this batch</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 14, color: COLORS.ink }}>{gen.notes}</div>
          </div>
        )}

        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <Button onClick={() => onLogCook(family.id, gen.id)}>Log a cook from here</Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Log a cook ----------

function LogCook({ family, fromGenId, onSave, onCancel, pantry, families }) {
  const base = findGen(family, fromGenId) || family.generations[0];
  const [label, setLabel] = useState("");
  const [ingredients, setIngredients] = useState(base.ingredients.map((i) => ({ ...i, id: uid() })));
  const [steps, setSteps] = useState(base.steps.join("\n"));
  const [servings, setServings] = useState(base.servings || 4);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [isKeeper, setIsKeeper] = useState(true);
  const [macroFields, setMacroFields] = useState(macrosToFields(base.macros));

  function updateIng(id, field, val) {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: val } : i)));
  }
  function addIng() {
    setIngredients((prev) => [...prev, { id: uid(), name: "", amount: "", unit: "" }]);
  }
  function removeIng(id) {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }
  function pickIngredient(itemName) {
    setIngredients((prev) => {
      const last = prev[prev.length - 1];
      if (last && !last.name.trim() && !last.amount && !last.unit) {
        return prev.map((i, idx) => (idx === prev.length - 1 ? { ...i, name: itemName } : i));
      }
      return [...prev, { id: uid(), name: itemName, amount: "", unit: "" }];
    });
  }

  function submit() {
    if (!label.trim()) return;
    const newGen = {
      id: uid(),
      parentId: base.id,
      label: label.trim(),
      servings: parseInt(servings, 10) || 4,
      ingredients: ingredients.filter((i) => i.name.trim()).map((i) => ({ ...i, amount: parseFloat(i.amount) || 0 })),
      steps: steps.split("\n").map((s) => stripLeadingNumber(s.trim())).filter(Boolean),
      notes: notes.trim(),
      macros: fieldsToMacros(macroFields),
      rating,
      isKeeper,
      cookedDate: todayISO(),
    };
    onSave(newGen);
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 500, marginBottom: 4 }}>Log a cook</h2>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.inkSoft, marginBottom: 22 }}>
        Branching from <em>{base.label}</em> — {family.name}. Edit anything you changed.
      </p>

      <Field label="What changed (this generation's name)">
        <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Doubled the garlic, less salt" />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Serves">
          <input type="number" min="1" style={inputStyle} value={servings} onChange={(e) => setServings(e.target.value)} />
        </Field>
        <Field label="How it turned out">
          <Stars value={rating} onChange={setRating} />
        </Field>
      </div>

      <Field label="Ingredients">
        <IngredientPicker pantry={pantry} onPick={pickIngredient} />
        <datalist id="pantry-ingredient-names">
          {combinedIngredientNames(pantry, families).map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {ingredients.map((ing) => (
          <div key={ing.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 28px", gap: 6, marginBottom: 6 }}>
            <input style={inputStyle} list="pantry-ingredient-names" value={ing.name} onChange={(e) => updateIng(ing.id, "name", e.target.value)} />
            <input style={inputStyle} value={ing.amount} onChange={(e) => updateIng(ing.id, "amount", e.target.value)} />
            <input style={inputStyle} value={ing.unit} onChange={(e) => updateIng(ing.id, "unit", e.target.value)} />
            <button onClick={() => removeIng(ing.id)} style={{ border: "none", background: "transparent", color: COLORS.inkSoft, cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        ))}
        <button onClick={addIng} style={{ border: "none", background: "transparent", color: COLORS.plum, cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif", fontWeight: 600, padding: "4px 0" }}>
          + add ingredient
        </button>
      </Field>

      <Field label="Steps (one per line)">
        <textarea style={{ ...inputStyle, minHeight: 110, resize: "vertical", fontFamily: "'Inter', sans-serif" }} value={steps} onChange={(e) => setSteps(e.target.value)} />
      </Field>

      <Field label="Notes on this attempt">
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: "'Inter', sans-serif" }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What you'd do differently next time." />
      </Field>

      <Field label="Macros per serving (optional)">
        <MacroFields fields={macroFields} onChange={setMacroFields} />
      </Field>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.ink, cursor: "pointer" }}>
        <input type="checkbox" checked={isKeeper} onChange={(e) => setIsKeeper(e.target.checked)} />
        This is a keeper — make it the version this recipe opens to
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <Button onClick={submit}>Save generation</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ---------- Family tree ----------

function layoutTree(generations, rootId) {
  const byParent = {};
  generations.forEach((g) => {
    const p = g.parentId || "root";
    if (!byParent[p]) byParent[p] = [];
    byParent[p].push(g);
  });
  const positions = {};
  let xCounter = 0;
  function assign(id, depth) {
    const kids = byParent[id] || [];
    if (kids.length === 0) {
      positions[id] = { x: xCounter, y: depth };
      xCounter += 1;
    } else {
      kids.forEach((k) => assign(k.id, depth + 1));
      const xs = kids.map((k) => positions[k.id].x);
      positions[id] = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: depth };
    }
  }
  assign(rootId, 0);
  return positions;
}

function FamilyTree({ family, onSelect, onBack }) {
  const root = family.generations.find((g) => g.parentId === null);
  const positions = layoutTree(family.generations, root.id);
  const xUnit = 150;
  const yUnit = 118;
  const maxX = Math.max(...Object.values(positions).map((p) => p.x));
  const maxY = Math.max(...Object.values(positions).map((p) => p.y));
  const width = (maxX + 1) * xUnit + 40;
  const height = (maxY + 1) * yUnit + 60;

  return (
    <div>
      <button onClick={onBack} style={{ border: "none", background: "transparent", color: COLORS.inkSoft, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 12, marginBottom: 14, padding: 0 }}>
        ← back to {family.name}
      </button>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 500, marginBottom: 2 }}>{family.name} — lineage</h2>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.inkSoft, marginBottom: 20 }}>
        {family.generations.length} generations. Click a jar to open that version.
      </p>

      <div style={{ overflowX: "auto", background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: "20px 10px" }}>
        <svg width={width} height={height} style={{ display: "block", margin: "0 auto" }}>
          {family.generations
            .filter((g) => g.parentId)
            .map((g) => {
              const from = positions[g.parentId];
              const to = positions[g.id];
              const x1 = from.x * xUnit + 40, y1 = from.y * yUnit + 40;
              const x2 = to.x * xUnit + 40, y2 = to.y * yUnit + 40;
              const midY = (y1 + y2) / 2;
              return (
                <path
                  key={g.id}
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  fill="none"
                  stroke={COLORS.line}
                  strokeWidth="2"
                />
              );
            })}
          {family.generations.map((g) => {
            const p = positions[g.id];
            const cx = p.x * xUnit + 40, cy = p.y * yUnit + 40;
            const idx = family.generations.findIndex((x) => x.id === g.id) + 1;
            return (
              <g key={g.id} onClick={() => onSelect(g.id)} style={{ cursor: "pointer" }}>
                <circle cx={cx} cy={cy} r="26" fill={g.isKeeper ? COLORS.plum : COLORS.paperDeep} stroke={g.isKeeper ? COLORS.plum : COLORS.line} strokeWidth="2" />
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize="12" fontFamily="'JetBrains Mono', monospace" fill={g.isKeeper ? "#F7F1EA" : COLORS.ink}>
                  {idx}
                </text>
                <text x={cx} y={cy + 44} textAnchor="middle" fontSize="12" fontFamily="'Inter', sans-serif" fontWeight="500" fill={COLORS.ink}>
                  {g.label.length > 16 ? g.label.slice(0, 15) + "…" : g.label}
                </text>
                <text x={cx} y={cy + 58} textAnchor="middle" fontSize="11" fontFamily="'JetBrains Mono', monospace" fill={COLORS.mustard}>
                  {"★".repeat(g.rating || 0)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ---------- Meal plan ----------

const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snacks"];
const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function emptySlot() {
  return { items: [], image: null };
}

function emptyDay() {
  return { breakfast: emptySlot(), lunch: emptySlot(), dinner: emptySlot(), snacks: emptySlot() };
}

// Slots have gone through a couple of shapes as the feature grew (a plain
// string, then { text, image }, now { items: [], image }) — normalize
// whatever's stored into the current shape so every reader can rely on it.
function normalizeSlot(value) {
  if (value && typeof value === "object") {
    if (Array.isArray(value.items)) return { items: value.items, image: value.image || null };
    return { items: value.text ? [value.text] : [], image: value.image || null };
  }
  return { items: value ? [value] : [], image: null };
}

// A slot can be "linked" — set once via the "eating this all week" checkbox
// — meaning every day reads that slot from a single source day instead of
// its own stored value. Resolves what a given day+slot should actually
// show, plus whether this day is the source, a follower, or unlinked.
function getEffectiveSlot(week, day, slot) {
  const sourceDay = (week?.repeats || {})[slot] || null;
  const isSource = sourceDay === day;
  const isLinked = !!sourceDay && !isSource;
  const readDay = isLinked ? sourceDay : day;
  return { value: normalizeSlot(week?.days?.[readDay]?.[slot]), isSource, isLinked, sourceDay };
}

function weekFillCount(week) {
  if (!week) return 0;
  let n = 0;
  WEEK_DAYS.forEach((day) => {
    MEAL_SLOTS.forEach((slot) => {
      if (getEffectiveSlot(week, day, slot).value.items.length) n += 1;
    });
  });
  return n;
}

function pantryCategoryFor(itemName, pantry) {
  const lower = itemName.toLowerCase();
  const cat = (pantry?.categories || []).find((c) => c.items.some((it) => it.toLowerCase() === lower));
  return cat?.name || "Other";
}

// Builds one week's shopping list from the meal plan: a recipe item expands
// into its own ingredients (grouped per ingredient+unit+recipe, so amounts
// only ever multiply by repeat count — never summed across different units
// or different recipes); a pantry/freeform item is its own line. Follows
// "eat this all week" links via getEffectiveSlot, so a linked meal counts
// once per day it actually covers.
function buildShoppingList(week, families, pantry) {
  const groups = new Map();
  WEEK_DAYS.forEach((day) => {
    MEAL_SLOTS.forEach((slot) => {
      const { value } = getEffectiveSlot(week, day, slot);
      value.items.forEach((itemName) => {
        const recipe = families.find((f) => f.name.toLowerCase() === itemName.toLowerCase());
        if (recipe) {
          const gen = latestKeeper(recipe);
          gen.ingredients.forEach((ing) => {
            if (!ing.name) return;
            const key = `r:${recipe.name}|${ing.name}|${ing.unit}`;
            const existing = groups.get(key);
            if (existing) existing.count += 1;
            else {
              groups.set(key, {
                key,
                name: ing.name,
                amount: ing.amount || null,
                unit: ing.unit,
                source: recipe.name,
                count: 1,
                category: pantryCategoryFor(ing.name, pantry),
              });
            }
          });
          return;
        }
        const key = `p:${itemName.toLowerCase()}`;
        const existing = groups.get(key);
        if (existing) existing.count += 1;
        else {
          groups.set(key, {
            key,
            name: itemName,
            amount: null,
            unit: null,
            source: null,
            count: 1,
            category: pantryCategoryFor(itemName, pantry),
          });
        }
      });
    });
  });

  // Items added by hand from the pantry (not tied to a planned meal) merge
  // into the same list — same key scheme, so adding "asparagus" that's
  // already on the list from a recipe just marks it removable rather than
  // duplicating the line.
  (week?.shoppingExtras || []).forEach((itemName) => {
    const key = `p:${itemName.toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) existing.isExtra = true;
    else {
      groups.set(key, {
        key,
        name: itemName,
        amount: null,
        unit: null,
        source: null,
        count: 1,
        category: pantryCategoryFor(itemName, pantry),
        isExtra: true,
      });
    }
  });

  return [...groups.values()];
}

async function suggestWeek(recipes) {
  const res = await fetch("/api/suggest-week", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipes }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't shuffle a week");
  return data;
}

// Shrinks a picked photo down to a small JPEG data URL before it's stored —
// keeps the shared meal plan (one JSON blob in Redis) from ballooning.
function resizeImageFile(file, maxDim = 480, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that photo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't read that photo"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function pillStyle(active) {
  return {
    fontFamily: "'Inter', sans-serif",
    fontSize: 11,
    fontWeight: 500,
    padding: "3px 10px",
    borderRadius: 20,
    border: `1px solid ${active ? COLORS.plum : COLORS.line}`,
    background: active ? COLORS.plum : "transparent",
    color: active ? "#F7F1EA" : COLORS.inkSoft,
    cursor: "pointer",
  };
}

// One slot (e.g. "dinner") can hold more than one thing — a main plus a
// side or two. Items can be typed, or browsed from the shelf's recipes and
// the pantry (so "asparagus" as a side is one tap, not a typed sentence).
function MealItemSlot({ slot, value, pantry, families, macroIndex = {}, onChange, onRepeatWeek, onUnrepeatWeek, isSource, isLinked, sourceDay }) {
  const [draft, setDraft] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const [source, setSource] = useState("recipes");
  const [activeCat, setActiveCat] = useState(null);
  const [search, setSearch] = useState("");
  const [imgError, setImgError] = useState("");

  const slotValue = normalizeSlot(value);
  const hasItem = (name) => slotValue.items.some((it) => it.toLowerCase() === name.toLowerCase());

  // Following another day's "eat this all week" link — read-only mirror,
  // no controls. Editing/unlinking happens on the day that started it.
  if (isLinked) {
    return (
      <div style={{ padding: "10px 0", opacity: 0.45 }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.inkSoft, marginBottom: 6 }}>
          {slot}
        </div>
        {slotValue.items.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 4 }}>
            {slotValue.items.map((item) => {
              const m = macroIndex[item.toLowerCase()];
              return (
                <span
                  key={item}
                  style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, padding: "3px 9px", borderRadius: 20, border: `1px solid ${COLORS.line}`, background: COLORS.paper, color: COLORS.inkSoft }}
                >
                  {item}
                  {m && <span style={{ fontSize: 10.5 }}> · {Math.round(m.calories)}cal</span>}
                </span>
              );
            })}
          </div>
        ) : (
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.inkSoft }}>—</span>
        )}
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: COLORS.inkSoft, fontStyle: "italic" }}>
          same as {sourceDay} all week
        </div>
      </div>
    );
  }

  function addItem(name) {
    const clean = name.trim();
    if (!clean || hasItem(clean)) return;
    onChange(slot, { items: [...slotValue.items, clean] });
  }

  function removeItem(name) {
    onChange(slot, { items: slotValue.items.filter((it) => it !== name) });
  }

  function handleDraftSubmit(e) {
    e.preventDefault();
    addItem(draft);
    setDraft("");
  }

  async function handlePickImage(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImgError("");
    try {
      const dataUrl = await resizeImageFile(file);
      onChange(slot, { image: dataUrl });
    } catch (err) {
      setImgError(err.message || "Couldn't attach that photo");
    }
  }

  const recipesByCategory = {};
  families.forEach((f) => {
    (recipesByCategory[f.category] ||= []).push(f.name);
  });
  const pantryCategories = pantry?.categories || [];

  const categories = source === "recipes" ? Object.keys(recipesByCategory).sort() : pantryCategories.map((c) => c.name);
  const activeCatSafe = categories.includes(activeCat) ? activeCat : categories[0] || null;
  const q = search.trim().toLowerCase();

  const pool = q
    ? source === "recipes"
      ? Object.values(recipesByCategory).flat()
      : pantryCategories.flatMap((c) => c.items)
    : source === "recipes"
      ? recipesByCategory[activeCatSafe] || []
      : pantryCategories.find((c) => c.name === activeCatSafe)?.items || [];
  const visible = (q ? pool.filter((it) => it.toLowerCase().includes(q)) : pool).filter((it) => !hasItem(it));

  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.inkSoft, marginBottom: 6 }}>
        {slot}
      </div>

      {slotValue.items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {slotValue.items.map((item) => {
            const m = macroIndex[item.toLowerCase()];
            return (
              <span
                key={item}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "'Inter', sans-serif", fontSize: 12, padding: "3px 6px 3px 9px", borderRadius: 20, border: `1px solid ${COLORS.line}`, background: "#FFFDF8", color: COLORS.ink }}
              >
                {item}
                {m && <span style={{ color: COLORS.inkSoft, fontSize: 10.5 }}>· {Math.round(m.calories)}cal</span>}
                <button
                  type="button"
                  onClick={() => removeItem(item)}
                  style={{ border: "none", background: "transparent", color: COLORS.inkSoft, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <form onSubmit={handleDraftSubmit} style={{ display: "flex", gap: 6 }}>
        <input
          style={{ ...inputStyle, fontSize: 12.5, padding: "6px 8px", flex: 1 }}
          list="mealplan-item-names"
          placeholder="add a main, a side…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="button" onClick={() => setBrowsing((b) => !b)} style={pillStyle(browsing)}>
          browse
        </button>
      </form>

      {browsing && (
        <div style={{ marginTop: 8, padding: "8px 10px", background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <button type="button" onClick={() => { setSource("recipes"); setActiveCat(null); }} style={pillStyle(source === "recipes")}>
              Recipes
            </button>
            <button type="button" onClick={() => { setSource("pantry"); setActiveCat(null); }} style={pillStyle(source === "pantry")}>
              Pantry
            </button>
            <input
              style={{ ...inputStyle, fontSize: 11, padding: "4px 7px", marginLeft: "auto", width: 100 }}
              placeholder="search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {!q && categories.length > 1 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
              {categories.map((cat) => (
                <button key={cat} type="button" onClick={() => setActiveCat(cat)} style={pillStyle(cat === activeCatSafe)}>
                  {cat}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 130, overflowY: "auto" }}>
            {visible.length === 0 ? (
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.inkSoft }}>Nothing here yet.</span>
            ) : (
              visible.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => addItem(item)}
                  style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, padding: "4px 9px", borderRadius: 4, border: `1px solid ${COLORS.line}`, background: "#FFFDF8", color: COLORS.ink, cursor: "pointer" }}
                >
                  + {item}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {slotValue.items.length > 0 && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, fontFamily: "'Inter', sans-serif", fontSize: 11, color: COLORS.inkSoft, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={isSource}
            onChange={(e) => (e.target.checked ? onRepeatWeek() : onUnrepeatWeek())}
          />
          Eating this every day this week
        </label>
      )}

      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, minHeight: 18 }}>
        {slotValue.image ? (
          <>
            <img
              src={slotValue.image}
              alt=""
              style={{ width: 26, height: 26, borderRadius: 4, objectFit: "cover", border: `1px solid ${COLORS.line}` }}
            />
            <button
              type="button"
              onClick={() => onChange(slot, { image: null })}
              style={{ border: "none", background: "transparent", color: COLORS.inkSoft, fontSize: 11, fontFamily: "'Inter', sans-serif", cursor: "pointer", padding: 0, textDecoration: "underline" }}
            >
              remove photo
            </button>
          </>
        ) : (
          <label style={{ fontSize: 11, fontFamily: "'Inter', sans-serif", fontWeight: 600, color: COLORS.plum, cursor: "pointer" }}>
            📷 add photo
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handlePickImage} />
          </label>
        )}
      </div>
      {imgError && (
        <div style={{ color: "#8C3B2E", fontFamily: "'Inter', sans-serif", fontSize: 11, marginTop: 3 }}>{imgError}</div>
      )}
    </div>
  );
}

function DayCard({ day, week, pantry, families, macroIndex, onChange, onRepeatWeek, onUnrepeatWeek }) {
  const totals = computeDayTotals(week, day, macroIndex);
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: "14px 16px" }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 500, color: COLORS.ink, marginBottom: 4 }}>
        {day}
      </div>
      <div>
        {MEAL_SLOTS.map((slot, idx) => {
          const { value, isSource, isLinked, sourceDay } = getEffectiveSlot(week, day, slot);
          return (
            <div key={slot} style={{ borderTop: idx === 0 ? "none" : `1px solid ${COLORS.line}` }}>
              <MealItemSlot
                slot={slot}
                value={value}
                pantry={pantry}
                families={families}
                macroIndex={macroIndex}
                onChange={onChange}
                onRepeatWeek={() => onRepeatWeek(slot)}
                onUnrepeatWeek={() => onUnrepeatWeek(slot)}
                isSource={isSource}
                isLinked={isLinked}
                sourceDay={sourceDay}
              />
            </div>
          );
        })}
      </div>
      {totals && (
        <div style={{ marginTop: 6, paddingTop: 8, borderTop: `1px solid ${COLORS.line}`, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: COLORS.inkSoft }}>
          Today: {formatMacroLine(totals)}
        </div>
      )}
    </div>
  );
}

function ShoppingListModal({ weekNum, week, families, pantry, checked, onToggle, onClear, onAddExtra, onRemoveExtra, onClose }) {
  const [showAdd, setShowAdd] = useState(false);
  const items = buildShoppingList(week, families, pantry);
  const byCategory = {};
  items.forEach((it) => {
    (byCategory[it.category] ||= []).push(it);
  });
  const categories = Object.keys(byCategory).sort();
  const remaining = items.filter((it) => !checked[it.key]).length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(36,41,31,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: COLORS.paper, borderRadius: 6, padding: 20, maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 500, color: COLORS.ink }}>
            Shopping list — Week {weekNum}
          </span>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: COLORS.inkSoft, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 }}>
            ×
          </button>
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.inkSoft, marginTop: 4, marginBottom: 12 }}>
          {items.length === 0 ? "Nothing planned yet this week." : `${remaining} of ${items.length} left to grab.`}
        </p>

        <Button variant="ghost" onClick={() => setShowAdd((s) => !s)} style={{ marginBottom: 12 }}>
          {showAdd ? "Hide pantry" : "+ add from pantry"}
        </Button>
        {showAdd && <IngredientPicker pantry={pantry} onPick={onAddExtra} />}

        {categories.map((cat) => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.plum, marginBottom: 6, paddingBottom: 4, borderBottom: `1px solid ${COLORS.line}` }}>
              {cat}
            </div>
            {byCategory[cat].map((it) => {
              const isChecked = !!checked[it.key];
              return (
                <div key={it.key} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "5px 0" }}>
                  <label
                    style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1, fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: isChecked ? COLORS.inkSoft : COLORS.ink, textDecoration: isChecked ? "line-through" : "none", cursor: "pointer" }}
                  >
                    <input type="checkbox" checked={isChecked} onChange={() => onToggle(it.key)} style={{ marginTop: 3 }} />
                    <span>
                      {it.name}
                      {it.amount ? ` — ${roundAmt(it.amount * it.count)}${it.unit ? " " + it.unit : ""}` : it.count > 1 ? ` ×${it.count}` : ""}
                      {it.source && <span style={{ color: COLORS.inkSoft, fontStyle: "italic" }}> ({it.source})</span>}
                    </span>
                  </label>
                  {it.isExtra && (
                    <button
                      onClick={() => onRemoveExtra(it.name)}
                      title="Remove from list"
                      style={{ border: "none", background: "transparent", color: COLORS.inkSoft, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {items.length > 0 && (
          <Button variant="ghost" onClick={onClear} style={{ marginTop: 8 }}>
            Clear all checks
          </Button>
        )}
      </div>
    </div>
  );
}

function WeekPanel({ weekNum, week, pantry, families, macroIndex, onUpdateSlot, onRepeatSlotWeek, onUnrepeatSlotWeek, onShuffle, shuffleLoading, shuffleError, onToggleShoppingItem, onClearShoppingChecks, onAddShoppingExtra, onRemoveShoppingExtra }) {
  const [showShoppingList, setShowShoppingList] = useState(false);

  return (
    <div style={{ padding: "16px 18px 20px", borderTop: `1px solid ${COLORS.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.inkSoft, margin: 0 }}>
          Add a main and any sides for each slot — browse your recipes and pantry, or just type. A photo&rsquo;s optional.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" onClick={() => setShowShoppingList(true)}>🛒 Shopping list</Button>
          <Button variant="ghost" onClick={onShuffle} disabled={shuffleLoading}>
            {shuffleLoading ? "Shuffling…" : "🔀 Shuffle in a week"}
          </Button>
        </div>
      </div>
      {shuffleError && (
        <div style={{ color: "#8C3B2E", fontFamily: "'Inter', sans-serif", fontSize: 12.5, marginBottom: 12 }}>{shuffleError}</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {WEEK_DAYS.map((day) => (
          <DayCard
            key={day}
            day={day}
            week={week}
            pantry={pantry}
            families={families}
            macroIndex={macroIndex}
            onChange={(slot, patch) => onUpdateSlot(weekNum, day, slot, patch)}
            onRepeatWeek={(slot) => onRepeatSlotWeek(weekNum, day, slot)}
            onUnrepeatWeek={(slot) => onUnrepeatSlotWeek(weekNum, slot)}
          />
        ))}
      </div>

      {showShoppingList && (
        <ShoppingListModal
          weekNum={weekNum}
          week={week}
          families={families}
          pantry={pantry}
          checked={week?.shoppingChecked || {}}
          onToggle={(key) => onToggleShoppingItem(weekNum, key)}
          onClear={() => onClearShoppingChecks(weekNum)}
          onAddExtra={(name) => onAddShoppingExtra(weekNum, name)}
          onRemoveExtra={(name) => onRemoveShoppingExtra(weekNum, name)}
          onClose={() => setShowShoppingList(false)}
        />
      )}
    </div>
  );
}

function MealPlan({ mealPlan, families, pantry, onUpdateSlot, onRepeatSlotWeek, onUnrepeatSlotWeek, onShuffleWeek, onToggleShoppingItem, onClearShoppingChecks, onAddShoppingExtra, onRemoveShoppingExtra }) {
  const [expanded, setExpanded] = useState(null);
  const [shuffleLoadingWeek, setShuffleLoadingWeek] = useState(null);
  const [shuffleError, setShuffleError] = useState("");
  const recipes = families.map((f) => ({ name: f.name, category: f.category }));
  const mealItemNames = [
    ...new Set([...families.map((f) => f.name), ...(pantry?.categories || []).flatMap((c) => c.items)]),
  ].sort((a, b) => a.localeCompare(b));
  const macroIndex = buildMacroIndex(pantry, families);

  async function handleShuffle(weekNum) {
    setShuffleError("");
    setShuffleLoadingWeek(weekNum);
    try {
      await onShuffleWeek(weekNum, recipes);
    } catch (err) {
      setShuffleError(err.message || "Couldn't shuffle a week");
    } finally {
      setShuffleLoadingWeek(null);
    }
  }

  return (
    <div>
      <datalist id="mealplan-item-names">
        {mealItemNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 500, marginBottom: 4 }}>52-week meal plan</h2>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.inkSoft, marginBottom: 20 }}>
        Click a week to open it up and plan day by day.
      </p>

      <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 6, overflow: "hidden" }}>
        {Array.from({ length: 52 }, (_, i) => i + 1).map((weekNum) => {
          const week = mealPlan.weeks?.[weekNum];
          const isOpen = expanded === weekNum;
          const filled = weekFillCount(week);
          return (
            <div key={weekNum} style={{ borderTop: weekNum === 1 ? "none" : `1px solid ${COLORS.line}` }}>
              <button
                onClick={() => setExpanded(isOpen ? null : weekNum)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 18px",
                  background: isOpen ? COLORS.card : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 500, color: COLORS.ink }}>
                  Week {weekNum}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {filled > 0 && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: COLORS.inkSoft }}>
                      {filled}/{WEEK_DAYS.length * MEAL_SLOTS.length} planned
                    </span>
                  )}
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.inkSoft }}>{isOpen ? "▾" : "▸"}</span>
                </span>
              </button>
              {isOpen && (
                <WeekPanel
                  weekNum={weekNum}
                  week={week}
                  pantry={pantry}
                  families={families}
                  macroIndex={macroIndex}
                  onUpdateSlot={onUpdateSlot}
                  onRepeatSlotWeek={onRepeatSlotWeek}
                  onUnrepeatSlotWeek={onUnrepeatSlotWeek}
                  onShuffle={() => handleShuffle(weekNum)}
                  shuffleLoading={shuffleLoadingWeek === weekNum}
                  shuffleError={expanded === weekNum ? shuffleError : ""}
                  onToggleShoppingItem={onToggleShoppingItem}
                  onClearShoppingChecks={onClearShoppingChecks}
                  onAddShoppingExtra={onAddShoppingExtra}
                  onRemoveShoppingExtra={onRemoveShoppingExtra}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Pantry ----------

function PantryManager({ pantry, onUpdatePantry }) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemDrafts, setNewItemDrafts] = useState({});
  const [editingItem, setEditingItem] = useState(null); // { category, item } | null
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { code, label, serving, calories, protein, carbs, fat }
  const [scanCategory, setScanCategory] = useState(pantry.categories[0]?.name || "");
  const [scanError, setScanError] = useState("");

  function addItem(categoryName) {
    const val = (newItemDrafts[categoryName] || "").trim();
    if (!val) return;
    onUpdatePantry({
      ...pantry,
      categories: pantry.categories.map((c) =>
        c.name === categoryName && !c.items.some((it) => it.toLowerCase() === val.toLowerCase())
          ? { ...c, items: [...c.items, val] }
          : c
      ),
    });
    setNewItemDrafts((prev) => ({ ...prev, [categoryName]: "" }));
  }

  function removeItem(categoryName, item) {
    const macros = { ...(pantry.macros || {}) };
    delete macros[item];
    onUpdatePantry({
      ...pantry,
      categories: pantry.categories.map((c) =>
        c.name === categoryName ? { ...c, items: c.items.filter((it) => it !== item) } : c
      ),
      macros,
    });
  }

  function addCategory() {
    const val = newCategoryName.trim();
    if (!val || pantry.categories.some((c) => c.name.toLowerCase() === val.toLowerCase())) return;
    onUpdatePantry({ ...pantry, categories: [...pantry.categories, { name: val, items: [] }] });
    setNewCategoryName("");
  }

  function removeCategory(categoryName) {
    onUpdatePantry({ ...pantry, categories: pantry.categories.filter((c) => c.name !== categoryName) });
  }

  function saveItemMacros(item, macros) {
    const next = { ...(pantry.macros || {}) };
    if (macros) next[item] = macros;
    else delete next[item];
    onUpdatePantry({ ...pantry, macros: next });
    setEditingItem(null);
  }

  // Stable identity so the scanner's camera doesn't restart if PantryManager
  // re-renders mid-scan (e.g. a background pantry sync from another device).
  const handleBarcodeDetected = useCallback(async (code) => {
    setScanning(false);
    setScanError("");
    try {
      const result = await lookupBarcode(code);
      setScanResult({ code, ...result });
    } catch (err) {
      setScanError(err.message || "Couldn't find that product");
    }
  }, []);

  function confirmScannedItem(name, fields, serving) {
    const val = name.trim();
    if (!val) return;
    const category = scanCategory || pantry.categories[0]?.name;
    const macros = fieldsToMacros(fields);
    onUpdatePantry({
      ...pantry,
      categories: pantry.categories.map((c) =>
        c.name === category && !c.items.some((it) => it.toLowerCase() === val.toLowerCase())
          ? { ...c, items: [...c.items, val] }
          : c
      ),
      macros: macros ? { ...(pantry.macros || {}), [val]: { ...macros, serving: serving || "100g" } } : pantry.macros || {},
    });
    setScanResult(null);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 500, margin: 0 }}>Pantry</h2>
        <Button variant="ghost" onClick={() => setScanning(true)}>📷 scan a barcode</Button>
      </div>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.inkSoft, marginBottom: 20 }}>
        What shows up as quick-add chips when you&rsquo;re logging ingredients. Add anything you&rsquo;re missing, remove anything you won&rsquo;t use — tap <strong>ƒ</strong> on an item to add its calories/protein/carbs/fat.
      </p>

      {scanError && (
        <div style={{ color: "#8C3B2E", fontFamily: "'Inter', sans-serif", fontSize: 12.5, marginBottom: 16 }}>{scanError}</div>
      )}

      {scanResult && (
        <ScannedItemConfirm
          result={scanResult}
          categories={pantry.categories.map((c) => c.name)}
          category={scanCategory}
          onCategoryChange={setScanCategory}
          onConfirm={confirmScannedItem}
          onCancel={() => setScanResult(null)}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {pantry.categories.map((c) => (
          <div key={c.name} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 500, color: COLORS.ink }}>{c.name}</span>
              <button
                onClick={() => removeCategory(c.name)}
                style={{ border: "none", background: "transparent", color: COLORS.inkSoft, cursor: "pointer", fontSize: 11, fontFamily: "'Inter', sans-serif", textDecoration: "underline" }}
              >
                remove category
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {c.items.length === 0 ? (
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.inkSoft }}>No items yet.</span>
              ) : (
                c.items.map((item) => {
                  const macros = pantry.macros?.[item];
                  return (
                    <span
                      key={item}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "'Inter', sans-serif", fontSize: 12, padding: "4px 6px 4px 8px", borderRadius: 4, border: `1px solid ${COLORS.line}`, background: "#FFFDF8", color: COLORS.ink }}
                    >
                      {item}
                      {macros && (
                        <span style={{ color: COLORS.inkSoft, fontSize: 10.5 }}>· {Math.round(macros.calories)}cal</span>
                      )}
                      <button
                        onClick={() => setEditingItem({ category: c.name, item })}
                        title="Edit macros"
                        style={{ border: "none", background: "transparent", color: macros ? COLORS.moss : COLORS.plum, cursor: "pointer", fontSize: 12, lineHeight: 1, padding: "0 2px", fontStyle: "italic" }}
                      >
                        ƒ
                      </button>
                      <button
                        onClick={() => removeItem(c.name, item)}
                        style={{ border: "none", background: "transparent", color: COLORS.inkSoft, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })
              )}
            </div>

            {editingItem?.category === c.name && (
              <MacroEditor
                itemName={editingItem.item}
                macros={pantry.macros?.[editingItem.item]}
                onSave={(macros) => saveItemMacros(editingItem.item, macros)}
                onCancel={() => setEditingItem(null)}
              />
            )}

            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <input
                style={{ ...inputStyle, fontSize: 12, padding: "6px 8px" }}
                placeholder="add an item…"
                value={newItemDrafts[c.name] || ""}
                onChange={(e) => setNewItemDrafts((prev) => ({ ...prev, [c.name]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem(c.name);
                  }
                }}
              />
              <Button variant="ghost" onClick={() => addItem(c.name)} style={{ padding: "6px 10px", fontSize: 12 }}>
                Add
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 8, alignItems: "center", maxWidth: 380 }}>
        <input
          style={inputStyle}
          placeholder="New category name"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCategory();
            }
          }}
        />
        <Button variant="ghost" onClick={addCategory}>+ add category</Button>
      </div>

      {scanning && (
        <BarcodeScannerModal onDetected={handleBarcodeDetected} onClose={() => setScanning(false)} />
      )}
    </div>
  );
}

function ScannedItemConfirm({ result, categories, category, onCategoryChange, onConfirm, onCancel }) {
  const [name, setName] = useState(result.label);
  const [fields, setFields] = useState({
    calories: result.calories,
    protein: result.protein,
    carbs: result.carbs,
    fat: result.fat,
  });
  const [serving, setServing] = useState(result.serving || "100g");

  return (
    <div style={{ marginBottom: 20, padding: "14px 16px", background: COLORS.card, border: `1px solid ${COLORS.plum}`, borderRadius: 4, maxWidth: 420 }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.plum, marginBottom: 8 }}>
        Add scanned item
      </div>
      <Field label="Name">
        <input style={{ ...inputStyle, fontSize: 13 }} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <Field label="Category">
          <select style={inputStyle} value={category} onChange={(e) => onCategoryChange(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Serving">
          <input style={inputStyle} value={serving} onChange={(e) => setServing(e.target.value)} />
        </Field>
      </div>
      <MacroFields fields={fields} onChange={setFields} />
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <Button onClick={() => onConfirm(name, fields, serving)}>Add to pantry</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ---------- Login ----------

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSubmitting(true);
    setError("");
    try {
      await login(username.trim(), password);
      onLogin();
    } catch (err) {
      setError(err.message || "Couldn't log in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px 20px" }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 320 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 500, marginBottom: 4, textAlign: "center" }}>
          Dame and Ems&rsquo; Cookbook
        </h2>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.inkSoft, marginBottom: 22, textAlign: "center" }}>
          Log in to see the shelf.
        </p>

        <Field label="Username">
          <input
            style={inputStyle}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            style={inputStyle}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>

        {error && (
          <div style={{ color: "#8C3B2E", fontFamily: "'Inter', sans-serif", fontSize: 12.5, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <Button type="submit" style={{ width: "100%" }}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </div>
  );
}

// ---------- App ----------

export default function App() {
  const [families, setFamilies] = useState([]);
  const [mealPlan, setMealPlan] = useState({ weeks: {} });
  const [pantry, setPantry] = useState({ categories: [] });
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(false);
  const [view, setView] = useState({ screen: "shelf" });
  const [authStatus, setAuthStatus] = useState("checking"); // "checking" | "out" | "in"

  useEffect(() => {
    let cancelled = false;
    checkSession()
      .then((authed) => {
        if (!cancelled) setAuthStatus(authed ? "in" : "out");
      })
      .catch(() => {
        if (!cancelled) setAuthStatus("out");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authStatus !== "in") return;
    let cancelled = false;

    async function refresh() {
      try {
        const [server, serverPlan, serverPantry] = await Promise.all([fetchFamilies(), fetchMealPlan(), fetchPantry()]);
        if (cancelled) return;
        setFamilies(server);
        cacheFamilies(server);
        setMealPlan(serverPlan);
        cacheMealPlan(serverPlan);
        setPantry(serverPantry);
        cachePantry(serverPantry);
        setSyncError(false);
      } catch {
        if (!cancelled) setSyncError(true);
      }
    }

    async function init() {
      const cached = loadCachedFamilies();
      if (cached) setFamilies(cached);
      const cachedPlan = loadCachedMealPlan();
      if (cachedPlan) setMealPlan(cachedPlan);
      const cachedPantry = loadCachedPantry();
      if (cachedPantry) setPantry(cachedPantry);
      try {
        const [server, serverPlan, serverPantry] = await Promise.all([fetchFamilies(), fetchMealPlan(), fetchPantry()]);
        if (cancelled) return;
        if (server.length === 0 && cached && cached.length > 0) {
          // first load after the shelf became shared: carry this device's
          // existing recipes up to the server instead of losing them
          await pushFamilies(cached);
          if (!cancelled) setFamilies(cached);
        } else {
          setFamilies(server);
          cacheFamilies(server);
        }
        setMealPlan(serverPlan);
        cacheMealPlan(serverPlan);
        setPantry(serverPantry);
        cachePantry(serverPantry);
        setSyncError(false);
      } catch {
        if (!cancelled) setSyncError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    function onVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authStatus]);

  function persist(next) {
    setFamilies(next);
    cacheFamilies(next);
    pushFamilies(next)
      .then(() => setSyncError(false))
      .catch(() => setSyncError(true));
  }

  function handleLogout() {
    logout().finally(() => {
      setFamilies([]);
      setView({ screen: "shelf" });
      setAuthStatus("out");
    });
  }

  function handleCreate(family, genId) {
    persist([...families, family]);
    setView({ screen: "recipe", familyId: family.id, genId });
  }

  function handleSaveCook(familyId, newGen) {
    const next = families.map((f) => {
      if (f.id !== familyId) return f;
      return { ...f, generations: [...f.generations, newGen] };
    });
    persist(next);
    setView({ screen: "recipe", familyId, genId: newGen.id });
  }

  function handleRateGen(familyId, genId, rating) {
    const next = families.map((f) => {
      if (f.id !== familyId) return f;
      return { ...f, generations: f.generations.map((g) => (g.id === genId ? { ...g, rating } : g)) };
    });
    persist(next);
  }

  function handleRecategorize(familyId, category) {
    const next = families.map((f) => (f.id === familyId ? { ...f, category } : f));
    persist(next);
  }

  function persistMealPlan(next) {
    setMealPlan(next);
    cacheMealPlan(next);
    pushMealPlan(next)
      .then(() => setSyncError(false))
      .catch(() => setSyncError(true));
  }

  function persistPantry(next) {
    setPantry(next);
    cachePantry(next);
    pushPantry(next)
      .then(() => setSyncError(false))
      .catch(() => setSyncError(true));
  }

  function handleUpdateMealSlot(weekNum, day, slot, patch) {
    const weeks = { ...mealPlan.weeks };
    const week = weeks[weekNum] || { days: {} };
    const days = { ...week.days };
    const dayObj = { ...emptyDay(), ...days[day] };
    dayObj[slot] = { ...normalizeSlot(dayObj[slot]), ...patch };
    days[day] = dayObj;
    weeks[weekNum] = { ...week, days };
    persistMealPlan({ ...mealPlan, weeks });
  }

  // "Eating this all week": links a slot (e.g. dinner) to one source day
  // for the whole week. Every other day just reads the source day's value
  // (see getEffectiveSlot) rather than getting a one-time copy — so
  // unchecking cleanly reverts every other day, and editing the source day
  // later keeps every linked day in sync automatically.
  function handleRepeatSlotWeek(weekNum, sourceDay, slot) {
    const weeks = { ...mealPlan.weeks };
    const week = weeks[weekNum] || { days: {}, repeats: {} };
    const repeats = { ...(week.repeats || {}), [slot]: sourceDay };
    weeks[weekNum] = { ...week, repeats };
    persistMealPlan({ ...mealPlan, weeks });
  }

  function handleUnrepeatSlotWeek(weekNum, slot) {
    const weeks = { ...mealPlan.weeks };
    const week = weeks[weekNum] || { days: {}, repeats: {} };
    const repeats = { ...(week.repeats || {}) };
    delete repeats[slot];
    weeks[weekNum] = { ...week, repeats };
    persistMealPlan({ ...mealPlan, weeks });
  }

  function handleToggleShoppingItem(weekNum, itemKey) {
    const weeks = { ...mealPlan.weeks };
    const week = weeks[weekNum] || { days: {}, repeats: {}, shoppingChecked: {} };
    const shoppingChecked = { ...(week.shoppingChecked || {}) };
    if (shoppingChecked[itemKey]) delete shoppingChecked[itemKey];
    else shoppingChecked[itemKey] = true;
    weeks[weekNum] = { ...week, shoppingChecked };
    persistMealPlan({ ...mealPlan, weeks });
  }

  function handleClearShoppingChecks(weekNum) {
    const weeks = { ...mealPlan.weeks };
    const week = weeks[weekNum] || { days: {}, repeats: {}, shoppingChecked: {} };
    weeks[weekNum] = { ...week, shoppingChecked: {} };
    persistMealPlan({ ...mealPlan, weeks });
  }

  function handleAddShoppingExtra(weekNum, itemName) {
    const weeks = { ...mealPlan.weeks };
    const week = weeks[weekNum] || { days: {}, repeats: {}, shoppingChecked: {}, shoppingExtras: [] };
    const extras = week.shoppingExtras || [];
    if (extras.some((n) => n.toLowerCase() === itemName.toLowerCase())) return;
    weeks[weekNum] = { ...week, shoppingExtras: [...extras, itemName] };
    persistMealPlan({ ...mealPlan, weeks });
  }

  function handleRemoveShoppingExtra(weekNum, itemName) {
    const weeks = { ...mealPlan.weeks };
    const week = weeks[weekNum] || { days: {}, repeats: {}, shoppingChecked: {}, shoppingExtras: [] };
    const extras = (week.shoppingExtras || []).filter((n) => n.toLowerCase() !== itemName.toLowerCase());
    weeks[weekNum] = { ...week, shoppingExtras: extras };
    persistMealPlan({ ...mealPlan, weeks });
  }

  async function handleShuffleWeek(weekNum, recipes) {
    const suggestion = await suggestWeek(recipes);
    const weeks = { ...mealPlan.weeks };
    const week = weeks[weekNum] || { days: {}, repeats: {} };
    const days = { ...week.days };
    const repeats = week.repeats || {};
    WEEK_DAYS.forEach((day) => {
      const dayObj = { ...emptyDay(), ...days[day] };
      const suggested = suggestion.days?.[day] || {};
      MEAL_SLOTS.forEach((slot) => {
        const sourceDay = repeats[slot];
        if (sourceDay && sourceDay !== day) return; // follows another day — don't fill separately
        const current = normalizeSlot(dayObj[slot]);
        dayObj[slot] = current.items.length === 0 && suggested[slot] ? { ...current, items: [suggested[slot]] } : current;
      });
      days[day] = dayObj;
    });
    weeks[weekNum] = { ...week, days };
    persistMealPlan({ ...mealPlan, weeks });
  }

  if (authStatus === "checking") {
    return (
      <div style={{ padding: 60, textAlign: "center", fontFamily: "'Fraunces', serif", fontStyle: "italic", color: COLORS.inkSoft }}>
        Opening the pantry…
      </div>
    );
  }

  if (authStatus === "out") {
    return (
      <div style={{ background: COLORS.paper, minHeight: "100vh", color: COLORS.ink }}>
        <style>{FONTS_IMPORT}{`
          * { box-sizing: border-box; }
          input:focus { outline: 2px solid ${COLORS.plum}; outline-offset: 1px; }
        `}</style>
        <Login onLogin={() => setAuthStatus("in")} />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", fontFamily: "'Fraunces', serif", fontStyle: "italic", color: COLORS.inkSoft }}>
        Opening the pantry…
      </div>
    );
  }

  const activeFamily = view.familyId ? families.find((f) => f.id === view.familyId) : null;

  return (
    <div style={{ background: COLORS.paper, minHeight: "100vh", color: COLORS.ink }}>
      <style>{FONTS_IMPORT}{`
        * { box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { outline: 2px solid ${COLORS.plum}; outline-offset: 1px; }
      `}</style>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ paddingTop: 36, paddingBottom: 8 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: COLORS.mustard, marginBottom: 4 }}>
            a cookbook that keeps evolving
          </div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 36, fontWeight: 500, margin: 0, color: COLORS.ink }}>
            <span>Dame and Ems&rsquo; Cookbook</span>
            <img
              src={COVER_LOGO}
              alt="Dame and Em, cooking up memories"
              style={{ width: 52, height: 52, borderRadius: "50%", border: `2px solid ${COLORS.mustard}`, objectFit: "cover", flexShrink: 0 }}
            />
          </h1>
        </div>

        {syncError && (
          <div style={{ background: COLORS.mustard, color: COLORS.ink, fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 500, padding: "8px 14px", borderRadius: 4, marginBottom: 20 }}>
            Couldn&rsquo;t reach the shared cookbook — showing your last saved copy. Changes will sync once you&rsquo;re back online.
          </div>
        )}

        <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.line}`, marginBottom: 28 }}>
          <Tab label="The shelf" active={view.screen === "shelf" || view.screen === "recipe" || view.screen === "tree"} onClick={() => setView({ screen: "shelf" })} />
          <Tab label="New recipe" active={view.screen === "new"} onClick={() => setView({ screen: "new" })} />
          <Tab label="Meal plan" active={view.screen === "mealplan"} onClick={() => setView({ screen: "mealplan" })} />
          <Tab label="Pantry" active={view.screen === "pantry"} onClick={() => setView({ screen: "pantry" })} />
        </div>

        <div style={{ paddingBottom: 60 }}>
          {view.screen === "shelf" && (
            <Shelf
              families={families}
              onOpen={(familyId, genId) => setView({ screen: "recipe", familyId, genId })}
              onNew={() => setView({ screen: "new" })}
              onRecategorize={handleRecategorize}
            />
          )}

          {view.screen === "new" && (
            <NewCulture onCreate={handleCreate} onCancel={() => setView({ screen: "shelf" })} pantry={pantry} families={families} />
          )}

          {view.screen === "recipe" && activeFamily && (
            <RecipeDetail
              family={activeFamily}
              genId={view.genId}
              onSetGen={(genId) => setView({ ...view, genId })}
              onViewTree={() => setView({ screen: "tree", familyId: activeFamily.id })}
              onLogCook={(familyId, fromGenId) => setView({ screen: "log", familyId, fromGenId })}
              onBack={() => setView({ screen: "shelf" })}
              onRateGen={(genId, rating) => handleRateGen(activeFamily.id, genId, rating)}
            />
          )}

          {view.screen === "tree" && activeFamily && (
            <FamilyTree
              family={activeFamily}
              onSelect={(genId) => setView({ screen: "recipe", familyId: activeFamily.id, genId })}
              onBack={() => setView({ screen: "recipe", familyId: activeFamily.id, genId: latestKeeper(activeFamily).id })}
            />
          )}

          {view.screen === "log" && activeFamily && (
            <LogCook
              family={activeFamily}
              fromGenId={view.fromGenId}
              onSave={(newGen) => handleSaveCook(activeFamily.id, newGen)}
              onCancel={() => setView({ screen: "recipe", familyId: activeFamily.id, genId: view.fromGenId })}
              pantry={pantry}
              families={families}
            />
          )}

          {view.screen === "mealplan" && (
            <MealPlan
              mealPlan={mealPlan}
              families={families}
              pantry={pantry}
              onUpdateSlot={handleUpdateMealSlot}
              onRepeatSlotWeek={handleRepeatSlotWeek}
              onUnrepeatSlotWeek={handleUnrepeatSlotWeek}
              onShuffleWeek={handleShuffleWeek}
              onToggleShoppingItem={handleToggleShoppingItem}
              onClearShoppingChecks={handleClearShoppingChecks}
              onAddShoppingExtra={handleAddShoppingExtra}
              onRemoveShoppingExtra={handleRemoveShoppingExtra}
            />
          )}

          {view.screen === "pantry" && (
            <PantryManager pantry={pantry} onUpdatePantry={persistPantry} />
          )}
        </div>

        <div style={{ borderTop: `1px solid ${COLORS.line}`, padding: "16px 0 40px", display: "flex", justifyContent: "flex-end", gap: 18, flexWrap: "wrap" }}>
          <button onClick={handleLogout} style={{ border: "none", background: "transparent", color: COLORS.inkSoft, fontSize: 11, fontFamily: "'Inter', sans-serif", cursor: "pointer", textDecoration: "underline" }}>
            log out
          </button>
        </div>
      </div>
    </div>
  );
}
