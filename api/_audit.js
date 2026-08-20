import { Redis } from "@upstash/redis";
import crypto from "crypto";

const redis = Redis.fromEnv();

function uid() {
  return crypto.randomBytes(8).toString("hex");
}

function entryBase(type, action, user) {
  return {
    id: uid(),
    at: new Date().toISOString(),
    userId: user?.id || null,
    userName: user?.name || "unknown",
    type,
    action,
  };
}

// LPUSH only, no EX/LTRIM anywhere in this file — that's the literal
// mechanism for "keep everything forever."
export async function appendAuditEntries(type, entries) {
  if (!entries.length) return;
  try {
    await redis.lpush(`audit:${type}`, ...entries.map((e) => JSON.stringify(e)));
  } catch (err) {
    console.error(`audit log write failed for ${type}:`, err);
  }
}

// Diffs the families array by id: only-in-after -> create, only-in-before ->
// delete, present in both but changed -> edit. Never blocks the actual save.
export function diffFamilies(before, after, user) {
  const beforeById = new Map((before || []).map((f) => [f.id, f]));
  const afterById = new Map((after || []).map((f) => [f.id, f]));
  const entries = [];

  for (const [id, afterFamily] of afterById) {
    const beforeFamily = beforeById.get(id);
    if (!beforeFamily) {
      entries.push({ ...entryBase("families", "create", user), entityId: id, before: null, after: afterFamily });
    } else if (JSON.stringify(beforeFamily) !== JSON.stringify(afterFamily)) {
      entries.push({ ...entryBase("families", "edit", user), entityId: id, before: beforeFamily, after: afterFamily });
    }
  }
  for (const [id, beforeFamily] of beforeById) {
    if (!afterById.has(id)) {
      entries.push({ ...entryBase("families", "delete", user), entityId: id, before: beforeFamily, after: null });
    }
  }
  return entries;
}

export function logBlobChange(type, before, after, user) {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  return [{ ...entryBase(type, "edit", user), entityId: type, before, after }];
}
