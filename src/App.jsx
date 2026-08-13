import { useState, useEffect } from "react";

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

function Button({ children, onClick, variant = "primary", style, type = "button" }) {
  const base = {
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.01em",
    padding: "9px 16px",
    borderRadius: 3,
    cursor: "pointer",
    border: "1px solid " + COLORS.ink,
  };
  const variants = {
    primary: { background: COLORS.plum, color: "#F7F1EA", border: `1px solid ${COLORS.plum}` },
    ghost: { background: "transparent", color: COLORS.ink, border: `1px solid ${COLORS.line}` },
    danger: { background: "transparent", color: "#8C3B2E", border: "1px solid #8C3B2E" },
  };
  return (
    <button type={type} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
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

// ---------- Shelf ----------

function Shelf({ families, onOpen, onNew, onRecategorize }) {
  const [filter, setFilter] = useState("All");
  const [dragOverCategory, setDragOverCategory] = useState(null);
  const shown = filter === "All" ? families : families.filter((f) => f.category === filter);

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
          Nothing on the shelf in this category yet.
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

// ---------- New culture (create family + generation 0) ----------

function NewCulture({ onCreate, onCancel }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [servings, setServings] = useState(4);
  const [ingredients, setIngredients] = useState([{ id: uid(), name: "", amount: "", unit: "" }]);
  const [steps, setSteps] = useState("");
  const [notes, setNotes] = useState("");

  function updateIng(id, field, val) {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: val } : i)));
  }
  function addIng() {
    setIngredients((prev) => [...prev, { id: uid(), name: "", amount: "", unit: "" }]);
  }
  function removeIng(id) {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
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
          steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
          notes: notes.trim(),
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
        {ingredients.map((ing) => (
          <div key={ing.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 28px", gap: 6, marginBottom: 6 }}>
            <input style={inputStyle} placeholder="onion, diced" value={ing.name} onChange={(e) => updateIng(ing.id, "name", e.target.value)} />
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

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 32 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.inkSoft }}>Serves</span>
            <button onClick={() => setServings((s) => Math.max(1, s - 1))} style={{ width: 24, height: 24, border: `1px solid ${COLORS.line}`, background: "transparent", cursor: "pointer", borderRadius: 3 }}>−</button>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, minWidth: 20, textAlign: "center" }}>{servings}</span>
            <button onClick={() => setServings((s) => s + 1)} style={{ width: 24, height: 24, border: `1px solid ${COLORS.line}`, background: "transparent", cursor: "pointer", borderRadius: 3 }}>+</button>
          </div>

          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.inkSoft, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${COLORS.line}` }}>
            Ingredients
          </div>
          {gen.ingredients.length === 0 ? (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.inkSoft }}>None recorded.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
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
        </div>

        <div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.inkSoft, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${COLORS.line}` }}>
            Steps
          </div>
          {gen.steps.length === 0 ? (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.inkSoft }}>None recorded.</p>
          ) : (
            <ol style={{ paddingLeft: 20, margin: 0 }}>
              {gen.steps.map((s, idx) => (
                <li key={idx} style={{ fontFamily: "'Inter', sans-serif", fontSize: 14.5, lineHeight: 1.7, color: COLORS.ink, marginBottom: 6 }}>
                  {s}
                </li>
              ))}
            </ol>
          )}

          {gen.notes && (
            <div style={{ marginTop: 18, padding: "12px 14px", background: COLORS.card, borderLeft: `3px solid ${COLORS.mustard}`, borderRadius: "0 3px 3px 0" }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.inkSoft, marginBottom: 4 }}>Notes from this batch</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 14, color: COLORS.ink }}>{gen.notes}</div>
            </div>
          )}

          <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
            <Button onClick={() => onLogCook(family.id, gen.id)}>Log a cook from here</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Log a cook ----------

function LogCook({ family, fromGenId, onSave, onCancel }) {
  const base = findGen(family, fromGenId) || family.generations[0];
  const [label, setLabel] = useState("");
  const [ingredients, setIngredients] = useState(base.ingredients.map((i) => ({ ...i, id: uid() })));
  const [steps, setSteps] = useState(base.steps.join("\n"));
  const [servings, setServings] = useState(base.servings || 4);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [isKeeper, setIsKeeper] = useState(true);

  function updateIng(id, field, val) {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: val } : i)));
  }
  function addIng() {
    setIngredients((prev) => [...prev, { id: uid(), name: "", amount: "", unit: "" }]);
  }
  function removeIng(id) {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }

  function submit() {
    if (!label.trim()) return;
    const newGen = {
      id: uid(),
      parentId: base.id,
      label: label.trim(),
      servings: parseInt(servings, 10) || 4,
      ingredients: ingredients.filter((i) => i.name.trim()).map((i) => ({ ...i, amount: parseFloat(i.amount) || 0 })),
      steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
      notes: notes.trim(),
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
        {ingredients.map((ing) => (
          <div key={ing.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 28px", gap: 6, marginBottom: 6 }}>
            <input style={inputStyle} value={ing.name} onChange={(e) => updateIng(ing.id, "name", e.target.value)} />
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
        const server = await fetchFamilies();
        if (cancelled) return;
        setFamilies(server);
        cacheFamilies(server);
        setSyncError(false);
      } catch {
        if (!cancelled) setSyncError(true);
      }
    }

    async function init() {
      const cached = loadCachedFamilies();
      if (cached) setFamilies(cached);
      try {
        const server = await fetchFamilies();
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
            <NewCulture onCreate={handleCreate} onCancel={() => setView({ screen: "shelf" })} />
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
            />
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
