import { isAuthed } from "./_auth.js";

// Open Food Facts — free, keyless, community-run product database. No
// signup, no billing, no rate-limit tier to worry about.
export default async function handler(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  const { code } = req.query || {};
  if (!code || !String(code).trim()) {
    res.status(400).json({ error: "Missing barcode" });
    return;
  }

  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    if (!r.ok) {
      res.status(502).json({ error: "Barcode lookup failed" });
      return;
    }
    const data = await r.json();
    if (data.status !== 1 || !data.product) {
      res.status(404).json({ error: "No product found for that barcode" });
      return;
    }
    const n = data.product.nutriments || {};
    res.status(200).json({
      label: data.product.product_name || data.product.generic_name || `Item ${code}`,
      serving: "100g",
      calories: Math.round(n["energy-kcal_100g"] || 0),
      protein: Math.round(n["proteins_100g"] || 0),
      carbs: Math.round(n["carbohydrates_100g"] || 0),
      fat: Math.round(n["fat_100g"] || 0),
    });
  } catch (err) {
    res.status(502).json({ error: err.message || "Barcode lookup failed" });
  }
}
