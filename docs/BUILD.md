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
- Once `ANTHROPIC_API_KEY` is set: open Meal plan → expand a week → "✨
  AI-fill this week" → confirm all 7 days get short suggestions and nothing
  already typed gets clobbered.
