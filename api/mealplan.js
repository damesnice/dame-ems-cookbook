import { Redis } from "@upstash/redis";
import { requireUser } from "./_auth.js";
import { appendAuditEntries, logBlobChange } from "./_audit.js";

const redis = Redis.fromEnv();
const KEY = "mealplan";

export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  if (req.method === "GET") {
    const mealPlan = (await redis.get(KEY)) || { weeks: {} };
    res.status(200).json(mealPlan);
    return;
  }

  if (req.method === "PUT") {
    const mealPlan = req.body;
    if (!mealPlan || typeof mealPlan !== "object" || !mealPlan.weeks) {
      res.status(400).json({ error: "Expected a meal plan object with a weeks map" });
      return;
    }
    const before = (await redis.get(KEY)) || { weeks: {} };
    await redis.set(KEY, mealPlan);
    await appendAuditEntries("mealplan", logBlobChange("mealplan", before, mealPlan, user));
    res.status(200).json({ ok: true });
    return;
  }

  res.setHeader("Allow", "GET, PUT");
  res.status(405).json({ error: "Method not allowed" });
}
