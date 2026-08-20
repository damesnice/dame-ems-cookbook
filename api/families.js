import { Redis } from "@upstash/redis";
import { requireUser } from "./_auth.js";
import { appendAuditEntries, diffFamilies } from "./_audit.js";

const redis = Redis.fromEnv();
const KEY = "families";

export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  if (req.method === "GET") {
    const families = (await redis.get(KEY)) || [];
    res.status(200).json(families);
    return;
  }

  if (req.method === "PUT") {
    const families = req.body;
    if (!Array.isArray(families)) {
      res.status(400).json({ error: "Expected an array of families" });
      return;
    }
    const before = (await redis.get(KEY)) || [];
    await redis.set(KEY, families);
    await appendAuditEntries("families", diffFamilies(before, families, user));
    res.status(200).json({ ok: true });
    return;
  }

  res.setHeader("Allow", "GET, PUT");
  res.status(405).json({ error: "Method not allowed" });
}
