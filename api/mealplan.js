import { Redis } from "@upstash/redis";
import { isAuthed } from "./_auth.js";

const redis = Redis.fromEnv();
const KEY = "mealplan";

export default async function handler(req, res) {
  if (!isAuthed(req)) {
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
    await redis.set(KEY, mealPlan);
    res.status(200).json({ ok: true });
    return;
  }

  res.setHeader("Allow", "GET, PUT");
  res.status(405).json({ error: "Method not allowed" });
}
