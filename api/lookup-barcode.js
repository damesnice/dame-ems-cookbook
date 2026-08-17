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
    const num = (v) => (typeof v === "number" ? v : null);
    // Open Food Facts carries both per-100g and per-actual-serving figures.
    // A serving is almost never 100g (a granola bar's serving is ~24g), so
    // defaulting to per-100g overstates everything by several times over —
    // prefer the real per-serving numbers whenever the product has them.
    const kcal = (suffix) => num(n[`energy-kcal${suffix}`]) ?? (num(n[`energy${suffix}`]) != null ? n[`energy${suffix}`] / 4.184 : null);
    const servingSize = data.product.serving_size;
    const useServing = !!servingSize && kcal("_serving") != null;
    const suffix = useServing ? "_serving" : "_100g";

    res.status(200).json({
      label: data.product.product_name || data.product.generic_name || `Item ${code}`,
      serving: useServing ? servingSize : "100g",
      calories: Math.round(kcal(suffix) || 0),
      protein: Math.round(num(n[`proteins${suffix}`]) || 0),
      carbs: Math.round(num(n[`carbohydrates${suffix}`]) || 0),
      fat: Math.round(num(n[`fat${suffix}`]) || 0),
    });
  } catch (err) {
    res.status(502).json({ error: err.message || "Barcode lookup failed" });
  }
}
