import { Redis } from "@upstash/redis";
import { requireUser } from "./_auth.js";

const redis = Redis.fromEnv();
const VALID_TYPES = ["families", "pantry", "mealplan"];

export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { type, limit, offset } = req.query || {};
  if (!VALID_TYPES.includes(type)) {
    res.status(400).json({ error: `type must be one of ${VALID_TYPES.join(", ")}` });
    return;
  }
  const start = Number(offset) || 0;
  const count = Math.min(Number(limit) || 50, 200);
  const raw = await redis.lrange(`audit:${type}`, start, start + count - 1);
  const entries = raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r));
  res.status(200).json({ entries });
}
