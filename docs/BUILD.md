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

## 2026-08-16 — "Eating this all week" checkbox on meal slots

**What:** A checkbox under any filled meal slot — "Eating this every day
this week — fill the rest" — that copies that slot's items (and photo, if
any) onto the same slot for every other day in the week.

**Why:** Damon plans some meals once and repeats them all week (e.g. the
same breakfast Monday through Sunday) and didn't want to re-add or
re-browse the same thing 7 times.

**Scope: one slot, not the whole day.** Copies only the specific meal type
(e.g. dinner) across the week — not breakfast/lunch/snacks too — since his
ask was "that one meal for the whole week," and a day-wide copy would be a
much more surprising (and harder to undo) action to trigger from a single
checkbox.

**It's a one-shot action, not a persistent link.** Checking it fires the
copy immediately; it doesn't keep the days synced afterward, and
unchecking doesn't undo anything. Editing Tuesday's dinner later doesn't
touch Wednesday's — this avoided the much more complex alternative (tracking
which days are "linked" and reacting to edits anywhere in the chain) for a
feature whose whole point is a fast one-time fill:

```js
// src/App.jsx
function handleRepeatSlotWeek(weekNum, sourceDay, slot) {
  const weeks = { ...mealPlan.weeks };
  const week = weeks[weekNum] || { days: {} };
  const days = { ...week.days };
  const sourceValue = normalizeSlot(days[sourceDay]?.[slot]);
  WEEK_DAYS.forEach((day) => {
    const dayObj = { ...emptyDay(), ...days[day] };
    dayObj[slot] = { items: [...sourceValue.items], image: sourceValue.image };
    days[day] = dayObj;
  });
  weeks[weekNum] = { ...week, days };
  persistMealPlan({ ...mealPlan, weeks });
}
```

It overwrites every day's slot with the source day's items — deliberately,
since checking the box is an explicit "yes, replace whatever's there"
action, unlike the shuffle button (which only ever fills empty slots).
The checkbox itself only shows once a slot has at least one item (nothing
to repeat otherwise), and only appears checked on the day you clicked —
the days it filled don't light up their own checkboxes, since this is a
fire-once action, not a synced state.

**Verify it:** `npm run lint && npm run build` — both clean. Once deployed:
add a meal to Monday's breakfast, check "eating this every day this week",
confirm all 7 days now show that same breakfast; confirm Monday's lunch
was untouched.

## 2026-08-16 — Fix: unchecking "eat this all week" didn't undo it; grey out linked days

**What:** Reworked the "eating this all week" feature from a one-time copy
into an actual link, and greyed out the days that are following it.

**Why:** Two bugs/asks from Damon on the copy-based version: (1) unchecking
the box did nothing — the other days stayed filled, because checking it had
copied the data into each day independently, so there was nothing left
that remembered they were ever connected; (2) he wanted the linked days
visibly greyed out, not just filled in looking like normal independent
entries.

**The real fix was changing what "checked" means, not patching the
checkbox.** A copy is a one-way, forgettable operation — once Tuesday has
its own copy of Monday's dinner, there's no way to tell "this is a link"
from "I happened to type the same thing." So the whole approach changed:
checking the box no longer copies data into every day. It sets a pointer —
`week.repeats.dinner = "Monday"` — and every day's dinner is *read* through
that pointer instead of from its own stored value:

```js
// src/App.jsx
function getEffectiveSlot(week, day, slot) {
  const sourceDay = (week?.repeats || {})[slot] || null;
  const isSource = sourceDay === day;
  const isLinked = !!sourceDay && !isSource;
  const readDay = isLinked ? sourceDay : day;
  return { value: normalizeSlot(week?.days?.[readDay]?.[slot]), isSource, isLinked, sourceDay };
}
```

This one change gets both asks for free: unchecking just deletes the
pointer (`delete repeats[slot]`), and every other day's dinner instantly
reverts to whatever it actually has stored — which for a freshly-linked
week is nothing, so it goes back to empty, exactly the "unselect" Damon
wanted. And because followers never had their own copy in the first place,
`MealItemSlot` can render them as a plain read-only, 45%-opacity view — no
chips to remove, no add field, no browse button, just the mirrored items
and a small "same as Monday all week" note:

```js
// src/App.jsx — MealItemSlot, early return when isLinked
if (isLinked) {
  return (
    <div style={{ padding: "10px 0", opacity: 0.45 }}>
      {/* read-only chips, no controls */}
      <div style={{ fontStyle: "italic", ... }}>same as {sourceDay} all week</div>
    </div>
  );
}
```

The checkbox itself became a controlled input (`checked={isSource}`)
instead of the old fire-and-forget uncontrolled one, so it now accurately
reflects reality instead of just whatever the browser remembered you last
clicked.

**Two side effects worth knowing about, both intentional:**
- Editing the source day after linking now updates every follower day live
  (since they all read through the same pointer) — this wasn't possible
  with the old copy approach and is arguably a better feature, not just a
  fix.
- `weekFillCount` (the "X/28 planned" counter) and `handleShuffleWeek` (the
  shuffle button) both had to become repeat-aware — fill counting now reads
  through the same `getEffectiveSlot` so followers count as filled, and
  shuffle explicitly skips follower days rather than wastefully filling
  data that would stay hidden behind the link.

**Verify it:** `npm run lint && npm run build` — both clean. Once deployed:
link Monday's dinner across the week, confirm Tuesday–Sunday show it
greyed out with "same as Monday all week"; uncheck Monday's box and
confirm every other day goes back to empty (or whatever it had before, if
anything); edit Monday's dinner while still linked and confirm the other
days update without re-checking anything.

## 2026-08-16 — Macro tracking: pantry items, recipes, barcode scanner, meal plan totals

**What:** Calories/protein/carbs/fat on pantry items and recipes, a camera
barcode scanner for adding pantry items, and per-item + daily-total macro
display on the meal plan.

**Why, and how the scope got decided:** Damon asked for a "macro calculator
... add them to every meal and every pantry item," then, when asked how
recipe macros should be determined, said he wanted it "kind of like my
fitness pal" with a barcode scanner and photo-based food recognition. That
photo-scan part needs an AI vision model — the same paid Anthropic API he'd
already declined for the (much cheaper) meal-suggestion feature — so before
building anything, I flagged that tradeoff explicitly and asked how he
wanted to handle it. He chose to build everything free now (manual entry,
USDA name lookup, barcode scanner) and hold off on photo-based estimation
until he's ready to add billing.

**Three free, keyless data sources — no signup, no cost:**
- **Manual entry** — four number fields (calories/protein/carbs/fat) on
  every pantry item and every recipe.
- **USDA FoodData Central** (`api/lookup-nutrition.js`) — name-based lookup
  ("chicken breast" → per-100g macros). Uses the public `DEMO_KEY`, shared
  and rate-limited (30/hr, 1000/day) but sufficient for occasional family
  use; if that ever gets hit, a personal key from
  [fdc.nal.usda.gov/api-key-signup.html](https://fdc.nal.usda.gov/api-key-signup.html)
  is still free — just set `USDA_API_KEY` in Vercel env.
- **Open Food Facts** (`api/lookup-barcode.js`) — barcode → product macros,
  via a free community-run product database. No key at all, ever.

**Barcode scanning** uses `html5-qrcode` (new dependency) instead of the
browser-native `BarcodeDetector` API, which iOS Safari doesn't support —
this is a phone-first PWA, so that ruled it out immediately. The scanner
component lazy-loads the library (`import("html5-qrcode")` inside a
`useEffect`, not a top-level import) so its ~330KB chunk only downloads
when someone actually taps "scan a barcode," not on every page load:

```js
// src/App.jsx — BarcodeScannerModal
useEffect(() => {
  import("html5-qrcode").then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
    const scanner = new Html5Qrcode(regionId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13, /* ...UPC/EAN/Code128 */],
    });
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: {...} },
      (decodedText) => { /* fire onDetected once, guarded by a ref */ },
      () => {} // per-frame "nothing found" isn't an error
    );
  });
  return () => { /* stop + clear the camera on unmount */ };
}, []);
```

The detected-code callback is guarded with a ref (`detectedRef`) so a
barcode sitting in frame for multiple scan cycles only fires once. The
setup effect intentionally has an empty dependency array — `onDetected` is
wrapped in `useCallback(..., [])` on the caller side specifically so a
background pantry sync (another family member editing the pantry) can't
restart the camera mid-scan.

**Data model — additive, no migration needed:**

```js
// pantry.macros, keyed by exact item name (case-insensitive at read time)
pantry.macros["Asparagus"] = { serving: "100g", calories: 20, protein: 2, carbs: 4, fat: 0 };

// each recipe generation, entered directly per serving (not computed from
// ingredients — converting "1 cup" or "2 cloves" into grams is inconsistent
// enough that a direct number is more trustworthy than a fragile estimate)
generation.macros = { calories: 420, protein: 32, carbs: 38, fat: 16 };
```

Both are optional and additive to existing data — nothing needed rewriting.
Empty macro fields save as `null` rather than a record full of zeros
(`fieldsToMacros()`), so "0g fat, genuinely" stays distinguishable from
"never entered."

**Meal plan display** resolves each plan item (a name typed or picked, same
as any meal plan chip) against a combined pantry+recipe macro index, case-
insensitively, and shows calories inline on the chip plus a full
calories/protein/carbs/fat line summed across the whole day — items with no
macro data on file just don't contribute, no error, no blank slot:

```js
// src/App.jsx
function buildMacroIndex(pantry, families) { /* pantry.macros ∪ each recipe's latest-keeper macros, lowercased keys */ }
function computeDayTotals(week, day, macroIndex) { /* sums every slot's resolved items, following "eat this all week" links */ }
```

`computeDayTotals` reads through `getEffectiveSlot` (from the repeat-link
feature), so a day following another day's linked meal counts toward its
own daily total correctly, instead of showing zero for meals it didn't
independently enter.

**Verify it:** `npm run lint && npm run build` — both clean. Once deployed:
in Pantry, tap ƒ on an item, look up "banana," confirm fields fill in and
Save persists a calorie badge on the chip; tap "scan a barcode," scan a
real product, confirm the confirm-add panel pre-fills name and macros; add
macros to a recipe and confirm they show on its detail page; in Meal plan,
add that recipe and a pantry item with macros to the same day and confirm
the day's total line sums both correctly.

## 2026-08-17 — Fix: barcode scan showed inflated macros (was per-100g, not per-serving)

**What:** `api/lookup-barcode.js` now prefers Open Food Facts' actual
per-serving nutrition figures over its per-100g figures, and reports the
real serving description ("1 bar (24 g)") instead of always saying "100g."

**Why:** Damon reported the scanner identified the right product but with
wrong numbers. Traced it by fetching a real product (a Quaker granola bar,
barcode `0030000311752`) directly from Open Food Facts and comparing both
figures it returns for the same item:

| | per 100g (what we showed) | per actual serving — 1 bar, 24g (what the box says) |
|---|---|---|
| calories | 417 | 100 |
| protein | 4g | 1g |
| carbs | 71g | 17g |
| fat | 17g | 4g |

A ~4x overstatement — because almost no real-world serving is 100g, and the
old code only ever read the `_100g`-suffixed fields. Open Food Facts
carries both; the fix reads `_serving` fields (and the product's real
`serving_size` string) whenever they're present, falling back to `_100g`
only when a product has no per-serving data at all:

```js
// api/lookup-barcode.js
const kcal = (suffix) => num(n[`energy-kcal${suffix}`]) ?? (num(n[`energy${suffix}`]) != null ? n[`energy${suffix}`] / 4.184 : null);
const useServing = !!data.product.serving_size && kcal("_serving") != null;
const suffix = useServing ? "_serving" : "_100g";
// serving_size / protein / carbs / fat all read through the same suffix
```

Added a kJ→kcal fallback (`energy${suffix} / 4.184`) too, for the rare
product that has energy data but no `energy-kcal` variant — same class of
"missing field silently shows 0" bug, caught while fixing the main one.

**Not fixed, and can't fully be:** Open Food Facts is crowd-sourced, so a
specific product's data can still be wrong or missing regardless of which
field we read — that's a data-source limitation, not a bug. The confirm-add
screen (already there) is the safety net: it shows the resolved serving
size and macros editable, before anything saves, specifically so a bad or
missing entry can be corrected by hand rather than trusted blindly.

**Verify it:** `npm run lint && npm run build` — both clean. Once deployed:
scan a packaged snack (not a raw 100g-labeled item), and confirm the
confirm-add panel shows a serving like "1 bar (24g)" with numbers that
match the actual nutrition label, not numbers ~4x too high.
