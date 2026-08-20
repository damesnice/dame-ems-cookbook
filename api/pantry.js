import { Redis } from "@upstash/redis";
import { requireUser } from "./_auth.js";
import { DEFAULT_PANTRY } from "./_default-pantry.js";
import { appendAuditEntries, logBlobChange } from "./_audit.js";

const redis = Redis.fromEnv();
const KEY = "pantry";

export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  if (req.method === "GET") {
    const pantry = (await redis.get(KEY)) || DEFAULT_PANTRY;
    res.status(200).json(pantry);
    return;
  }

  if (req.method === "PUT") {
    const pantry = req.body;
    if (!pantry || !Array.isArray(pantry.categories)) {
      res.status(400).json({ error: "Expected a pantry object with a categories array" });
      return;
    }
    const before = (await redis.get(KEY)) || DEFAULT_PANTRY;
    await redis.set(KEY, pantry);
    await appendAuditEntries("pantry", logBlobChange("pantry", before, pantry, user));
    res.status(200).json({ ok: true });
    return;
  }

  res.setHeader("Allow", "GET, PUT");
  res.status(405).json({ error: "Method not allowed" });
}
