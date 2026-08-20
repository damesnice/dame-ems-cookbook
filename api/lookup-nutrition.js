import { requireUser } from "./_auth.js";

// USDA FoodData Central — free, keyless (DEMO_KEY) to start. DEMO_KEY is
// shared across everyone using it and rate-limited (30/hr, 1000/day per
// IP); set USDA_API_KEY in Vercel env with a personal free key from
// https://fdc.nal.usda.gov/api-key-signup.html if that ever gets hit.
export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  const { name } = req.query || {};
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: "Missing name" });
    return;
  }

  try {
    const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(name)}&pageSize=1&api_key=${apiKey}`;
    const r = await fetch(url);
    if (!r.ok) {
      res.status(502).json({ error: r.status === 429 ? "Nutrition lookup is rate-limited right now — try again shortly." : "Nutrition lookup failed" });
      return;
    }
    const data = await r.json();
    const food = data.foods?.[0];
    if (!food) {
      res.status(404).json({ error: `No nutrition match for "${name}"` });
      return;
    }
    const nutrient = (n) => food.foodNutrients?.find((fn) => fn.nutrientName === n)?.value || 0;
    res.status(200).json({
      label: food.description,
      serving: "100g",
      calories: Math.round(nutrient("Energy")),
      protein: Math.round(nutrient("Protein")),
      carbs: Math.round(nutrient("Carbohydrate, by difference")),
      fat: Math.round(nutrient("Total lipid (fat)")),
    });
  } catch (err) {
    res.status(502).json({ error: err.message || "Nutrition lookup failed" });
  }
}
