import { requireUser } from "./_auth.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Which recipe categories are reasonable picks for each meal slot, in
// priority order — falls back to the shared "any" pool when a slot's
// preferred categories have nothing logged yet.
const SLOT_CATEGORIES = {
  breakfast: ["Breakfast"],
  lunch: ["Side", "Main", "Other"],
  dinner: ["Main", "Dinner", "Sauce & ferment"],
  snacks: ["Dessert", "Baking", "Other"],
};

// Used only when the family hasn't logged any recipe that fits a slot yet,
// so the shuffle still returns something useful for a new cookbook.
const FALLBACK_IDEAS = {
  breakfast: ["Cereal & fruit", "Eggs on toast", "Yogurt with granola", "Oatmeal"],
  lunch: ["Sandwiches", "Leftovers", "Soup & bread", "Big salad"],
  dinner: ["Leftovers", "Pasta night", "Sheet-pan veggies & protein", "Order in"],
  snacks: ["Fruit & nuts", "Cheese & crackers", "Popcorn", "Veggies & hummus"],
};

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A cycling picker: shuffles the pool once, hands out names one at a time,
// and reshuffles once exhausted — so a week rarely repeats a dish unless
// the pool is smaller than 7.
function cyclingPicker(pool) {
  let order = shuffled(pool);
  let i = 0;
  return () => {
    if (order.length === 0) return null;
    if (i >= order.length) {
      order = shuffled(pool);
      i = 0;
    }
    return order[i++];
  };
}

export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { recipes } = req.body || {};
  const byCategory = {};
  (Array.isArray(recipes) ? recipes : []).forEach((r) => {
    if (!r || !r.name || !r.category) return;
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r.name);
  });

  const pickers = {};
  Object.keys(SLOT_CATEGORIES).forEach((slot) => {
    const pool = [];
    SLOT_CATEGORIES[slot].forEach((cat) => pool.push(...(byCategory[cat] || [])));
    pickers[slot] = pool.length ? cyclingPicker(pool) : cyclingPicker(FALLBACK_IDEAS[slot]);
  });

  const days = {};
  DAYS.forEach((day) => {
    days[day] = {
      breakfast: pickers.breakfast(),
      lunch: pickers.lunch(),
      dinner: pickers.dinner(),
      snacks: pickers.snacks(),
    };
  });

  res.status(200).json({ days });
}
