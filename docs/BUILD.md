# Build log

Chronological record of how this app was built and why. Code depth is "key
code per milestone" — the core new pieces in full, everything else pointed at
by path.

## Earlier milestones (from git history, brief)

1. **Initial commit** — React + Vite cookbook: family/generation recipe
   model (a recipe "family" with versioned "generations" you branch off when
   you cook it differently), local-only storage.
2. **Lint config + fixes** — added ESLint (flat config, React + hooks +
   refresh plugins) and cleaned up violations.
3. **Dinner category + drag-to-recategorize** — added `Dinner` to
   `CATEGORIES`, made shelf category pills drop targets.
4. **Shared recipe storage backed by Upstash Redis** (`api/families.js`) —
   the shelf moved from `localStorage`-only to a shared server store so
   everyone opens the same cookbook. `localStorage` kept as an offline cache
   only.
5. **Login required** (`api/login.js`, `api/_auth.js`) — cookie-session auth
   gate in front of the shared shelf; dropped the old local backup/reset
   flow since data now lives server-side.
6. **Multiple cookbook logins** — `COOKBOOK_USERNAME` env var became a
   comma-separated list so more than one person can log in.

## 2026-08-16 — Stack steps under ingredients; add a 52-week meal plan

**What:** Two changes to `src/App.jsx`, plus two new API routes.

**Why (layout fix):** The recipe detail view laid Ingredients and Steps out
side-by-side in a `260px 1fr` grid. On the actual device this made Steps
crowd into a narrow column next to a much taller Ingredients list. Changed
`RecipeDetail` to a single stacked column — Ingredients first, Steps
directly under it — which is also just a more natural reading order for a
recipe.

**Why (meal plan): a 52-week planner, opened week by week.** Damon wanted to
plan meals a year out without one giant flat form. Chose an accordion: 52
week rows, click one to expand it into 7 day cards (Mon–Sun), each with
breakfast/lunch/dinner/snacks fields. Only the expanded week renders its day
editors, so the list stays cheap regardless of how many weeks have data.

Data model — kept deliberately flat (no per-day linking to specific
recipes, just short text per slot) so a slot can hold either a cookbook
recipe name or a one-off idea like "leftovers":

```js
// mealPlan shape, persisted at api/mealplan.js under Redis key "mealplan"
{ weeks: { "1": { days: { Monday: { breakfast, lunch, dinner, snacks }, ... } }, ... } }
```

`api/mealplan.js` mirrors `api/families.js` exactly (GET/PUT, `isAuthed`
gate, one Redis key) — same shared-storage pattern, new key.

**Why AI suggestions call Claude directly instead of picking from existing
recipes with rules:** Damon asked for real variety, not just a shuffle of
what's already logged — a rules-based picker can't suggest anything outside
the current shelf. Added `api/suggest-week.js`, which calls
`claude-opus-5` with a JSON-schema-constrained response (one object per day,
one string per meal slot) so the output drops straight into the meal plan
with no parsing games:

```js
// api/suggest-week.js — schema shape (WEEK_SCHEMA), abridged
{
  type: "object",
  properties: { days: { type: "object", properties: /* Mon..Sun */, required: DAYS, additionalProperties: false } },
  required: ["days"], additionalProperties: false,
}
```

The endpoint is given the family's existing recipe names as context ("favor
recipes from the family's own cookbook when they fit") and returns short
menu-line suggestions, not instructions. On the client, "✨ AI-fill this
week" only fills *empty* slots — it won't overwrite anything already typed
in.

Requires `ANTHROPIC_API_KEY` (added `@anthropic-ai/sdk` as a dependency).
Not yet set locally or on Vercel — the button will show a clear error until
that's added.

**Verify it:**
- `npm run lint && npm run build` — both clean.
- Local smoke test via `npm run dev` confirmed the app still boots and
  compiles; full login → shelf → meal-plan flow needs `vercel dev` (or the
  deployed URL) since `/api/*` are Vercel functions, not served by plain
  Vite.

## 2026-08-16 — Swap the AI meal suggestions for a free shelf shuffle

**What:** Rewrote `api/suggest-week.js` from a Claude API call to a
rules-based picker over the family's own recipes; removed the
`@anthropic-ai/sdk` dependency; renamed the AI-flavored identifiers in
`src/App.jsx` (`onAiSuggestWeek` → `onShuffleWeek`, etc.) and the button
copy ("✨ AI-fill this week" → "🔀 Shuffle in a week").

**Why:** The Anthropic API is pay-as-you-go, not free — using it here would
have meant Damon adding billing to an API account for a feature that's cheap
per call but not zero-cost. Given the choice, he opted for the free option:
picking from the cookbook's own logged recipes instead of asking an LLM.
Loses the ability to suggest anything outside the shelf, but needs no API
key, no billing, and no external call at all.

**How the picker works** — each meal slot maps to the recipe categories that
make sense for it, falls back to a small built-in idea list when a category
has nothing logged yet, and cycles through a shuffled pool per slot so a
week rarely repeats a dish before the pool runs out:

```js
// api/suggest-week.js — slot → category mapping
const SLOT_CATEGORIES = {
  breakfast: ["Breakfast"],
  lunch: ["Side", "Main", "Other"],
  dinner: ["Main", "Dinner", "Sauce & ferment"],
  snacks: ["Dessert", "Baking", "Other"],
};
```

Client now sends `{ name, category }` for every recipe (previously just
names) so the endpoint has enough to sort by slot.

**Verify it:** `npm run lint && npm run build` — both clean. Once deployed:
open Meal plan → expand a week → "🔀 Shuffle in a week" → confirm all 7 days
fill in from the shelf (or the generic fallback ideas on a fresh cookbook)
and nothing already typed gets clobbered.

## 2026-08-16 — Fix doubled step numbers; add photos to meal plan slots

**What:** Two small fixes in `src/App.jsx`.

**Why (doubled numbers):** Damon logged a recipe whose steps were typed
already-numbered ("1. Heat a large skillet..."), and the `<ol>` that renders
Steps adds its own number — so it read "1. 1. Heat a large skillet...".
Added `stripLeadingNumber()`, a small regex (`/^\s*\d+[.)]\s*/`) applied in
three places: both step-parsing sites (`NewCulture`, `LogCook`, so new
entries are stored clean) and at render time in `RecipeDetail` (so recipes
*already* saved with the doubled prefix display correctly immediately,
without anyone re-typing them).

**Why (meal plan photos):** Damon asked for two things on the meal plan —
confirmed the free-text slot already supports typing anything (the
`list="cookbook-recipe-names"` datalist is autocomplete, not a locked
picker) — and added the ability to attach a photo per meal slot, so a
shuffled or typed-in meal can carry a picture of the actual dish.

Slot data changed shape from a plain string to `{ text, image }` (image is a
resized JPEG data URL, or `null`). Rather than migrate every already-saved
plan, added `normalizeSlot()` so any reader treats a legacy string slot and
the new object shape the same way — old data keeps working untouched, and
only gets upgraded to the new shape the next time that specific slot is
edited:

```js
// src/App.jsx
function normalizeSlot(value) {
  if (value && typeof value === "object") {
    return { text: value.text || "", image: value.image || null };
  }
  return { text: value || "", image: null };
}
```

Photos are resized client-side before they're stored — the whole meal plan
is one JSON blob in Redis, so an un-resized photo would bloat it fast:

```js
// src/App.jsx — resizeImageFile(file, maxDim = 480, quality = 0.72)
// FileReader -> Image -> draw to a maxDim-capped <canvas> -> canvas.toDataURL("image/jpeg", quality)
```

New `MealSlotField` component renders the text input plus a small "📷 add
photo" control (file input, `capture="environment"` so it opens the camera
directly on a phone) or, once a photo's attached, a 30px thumbnail with a
"remove photo" link.

**Verify it:** `npm run lint && npm run build` — both clean. Once deployed:
open an existing recipe with previously-doubled step numbers and confirm
they now read correctly; in Meal plan, type a custom (non-shelf) meal into
a slot, attach a photo to it from a phone camera, and confirm both persist
after leaving and reopening that week.

## 2026-08-16 — Add a Pantry: quick-add ingredient chips + autocomplete

**What:** New `/api/pantry` (same Redis GET/PUT pattern as families and the
meal plan), a new **Pantry** tab, and an `IngredientPicker` wired into both
the New recipe and Log a cook ingredient lists.

**Why:** Damon didn't want to type every ingredient by hand when logging a
recipe — he wanted to tap common ones (asparagus, low-fat cheese,
tortillas, flour, salt, pepper, Cajun seasoning...) instead. Landed on both
a tap-to-add picker *and* keeping the ingredient field's autocomplete, per
his answer when asked which style he wanted.

**Where the seed list came from:** Rather than hand-write a plausible-looking
pantry, pulled a real categorized grocery list and reorganized it for a
cookbook (dropped household/pet/baby aisles, kept food):
[Instacart's grocery list categories](https://company.instacart.com/ideas/grocery-list-categories).
That's `DEFAULT_PANTRY` in `api/_default-pantry.js` — 12 categories,
~180 items. It's only a *seed*: `/api/pantry` GET returns it when nothing's
been saved yet, but the moment the family edits anything, their version is
what's stored from then on (mirrors how the meal plan defaults to `{weeks:
{}}` until touched).

**Data model — kept it simple, one flat picker source:**

```js
// api/pantry.js — Redis key "pantry"
{ categories: [ { name: "Produce", items: ["Asparagus", "Onion", ...] }, ... ] }
```

**The picker combines two sources**, so tap-to-add and typeahead both work
from the same pool — the pantry list, plus every ingredient name already
typed into any of your own recipes (so it gets smarter over time without
any setup):

```js
// src/App.jsx
function combinedIngredientNames(pantry, families) {
  const set = new Set();
  (pantry?.categories || []).forEach((c) => c.items.forEach((it) => set.add(it)));
  families.forEach((f) =>
    f.generations.forEach((g) => g.ingredients.forEach((i) => i.name && set.add(i.name)))
  );
  return [...set].sort((a, b) => a.localeCompare(b));
}
```

`IngredientPicker` renders category pill tabs + a chip grid (with its own
search box that flattens across all categories while typing) above the
ingredient rows in both `NewCulture` and `LogCook`. Tapping a chip calls
`pickIngredient(name)`, which fills the last *empty* ingredient row instead
of always appending — so the first tap doesn't leave a stray blank row
above it:

```js
function pickIngredient(itemName) {
  setIngredients((prev) => {
    const last = prev[prev.length - 1];
    if (last && !last.name.trim() && !last.amount && !last.unit) {
      return prev.map((i, idx) => (idx === prev.length - 1 ? { ...i, name: itemName } : i));
    }
    return [...prev, { id: uid(), name: itemName, amount: "", unit: "" }];
  });
}
```

`PantryManager` (the Pantry tab itself) is a straightforward editable view:
each category is a card of removable chips plus an "add an item" input, and
there's an "add category" control at the bottom — since Damon asked for it
to stay editable, not fixed once I seeded it.

**Verify it:** `npm run lint && npm run build` — both clean. Once deployed:
open New recipe → Ingredients → confirm the pantry chips show up, tap a
few from different categories, confirm amount/unit stay editable per row;
go to Pantry, remove an item, come back to New recipe and confirm it's
gone from the chips; add a made-up item to Pantry and confirm it shows up
as a chip immediately.

## 2026-08-16 — Meal plan slots hold multiple items, browsable from pantry + recipes

**What:** Meal plan slots (breakfast/lunch/dinner/snacks) went from one text
field to a tag list — a main plus any sides — with a "browse" panel to pull
items from the shelf's recipes or the pantry instead of typing.

**Why:** Damon didn't want breakfast limited to one line — he wanted to add
a main and a side (his example: asparagus as a side) without cramming it
into one string, and wanted to pick sides from the pantry rather than type
them out. Asked to keep it "not too cluttered" — the browse panel is
collapsed by default (a "browse" toggle next to the add field) so a slot
with nothing browsed stays as compact as the old single-line version.

**Data model, third shape now:** slots have gone plain string → `{ text,
image }` → `{ items: [], image }` as the feature grew. Rather than migrate
stored data again, `normalizeSlot()` (already handling the string → object
migration) got a third branch, so every already-saved plan — from any of
the last three deploys — keeps reading correctly with no migration step:

```js
// src/App.jsx
function normalizeSlot(value) {
  if (value && typeof value === "object") {
    if (Array.isArray(value.items)) return { items: value.items, image: value.image || null };
    return { items: value.text ? [value.text] : [], image: value.image || null };
  }
  return { items: value ? [value] : [], image: null };
}
```

**The browse panel has two sources**, switchable with a small pill toggle:
"Recipes" (grouped by the same categories as the shelf — Main, Breakfast,
Dessert, etc.) and "Pantry" (grouped by pantry category), both with a
search box that flattens across categories while typing. The add-field
itself still autocompletes too (`list="mealplan-item-names"`, combining
recipe names + every pantry item) — same "let both styles work" choice as
the ingredient picker. Picking an item appends to that slot's `items`
array; already-added items are filtered out of the browse results so you
don't see a chip you can already see chipped above it.

Day cards changed from a 2×2 grid of short fields to a single-column stack
of slot rows — the old grid was fine for one line per slot, but felt
cramped once a slot could hold several chips plus an expandable browse
panel. Week view is now a vertical list of full-width day cards instead of
a multi-column grid, for the same reason.

**Verify it:** `npm run lint && npm run build` — both clean. Once deployed:
open Meal plan → expand a week → on a day's Dinner slot, browse Recipes and
add one, then browse Pantry and add "Asparagus" as a second item, confirm
both show as separate removable chips; confirm a week planned before this
change still shows its old single item correctly.
