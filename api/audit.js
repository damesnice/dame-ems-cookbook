import { Redis } from "@upstash/redis";
import { requireUser } from "./_auth.js";
import { appendAuditEntries } from "./_audit.js";
import crypto from "crypto";

const redis = Redis.fromEnv();
const VALID_TYPES = ["families", "pantry", "mealplan"];
const KEYS = { families: "families", pantry: "pantry", mealplan: "mealplan" };

function uid() {
  return crypto.randomBytes(8).toString("hex");
}

// Also handles restoring an entry (POST) — folded in here rather than a
// separate route to stay under Vercel's Hobby-plan serverless function cap.
async function restore(req, res, user) {
  const { type, entryId } = req.body || {};
  if (!VALID_TYPES.includes(type) || !entryId) {
    res.status(400).json({ error: "Missing or invalid type/entryId." });
    return;
  }

  // Household-scale volume — a full scan is fine here; revisit only if this
  // list ever grows unexpectedly large.
  const raw = await redis.lrange(`audit:${type}`, 0, -1);
  const entries = raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r));
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) {
    res.status(404).json({ error: "That history entry wasn't found." });
    return;
  }

  const key = KEYS[type];
  const current = (await redis.get(key)) || (type === "families" ? [] : type === "pantry" ? { categories: [] } : { weeks: {} });

  if (type === "families") {
    let restored;
    if (entry.before === null) {
      restored = current.filter((f) => f.id !== entry.entityId);
    } else {
      const exists = current.some((f) => f.id === entry.entityId);
      restored = exists
        ? current.map((f) => (f.id === entry.entityId ? entry.before : f))
        : [...current, entry.before];
    }
    await redis.set(key, restored);
    await appendAuditEntries("families", [
      {
        id: uid(),
        at: new Date().toISOString(),
        userId: user.id,
        userName: user.name,
        type: "families",
        action: "restore",
        entityId: entry.entityId,
        before: current.find((f) => f.id === entry.entityId) || null,
        after: entry.before,
      },
    ]);
  } else {
    await redis.set(key, entry.before);
    await appendAuditEntries(type, [
      {
        id: uid(),
        at: new Date().toISOString(),
        userId: user.id,
        userName: user.name,
        type,
        action: "restore",
        entityId: type,
        before: current,
        after: entry.before,
      },
    ]);
  }

  res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  if (req.method === "POST") {
    await restore(req, res, user);
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
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
