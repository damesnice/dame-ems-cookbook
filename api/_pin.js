// PINs replaced passwords (2026-10-21). They're hashed with the same scrypt
// helper as the old passwords; a short numeric secret is only safe because of
// the lockout below, which caps guessing at MAX_FAILS tries per LOCK_SECONDS.
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const MAX_FAILS = 5;
const LOCK_SECONDS = 60 * 15;

export function isValidPin(pin) {
  return typeof pin === "string" && /^\d{4,8}$/.test(pin);
}

export async function isLockedOut(userId) {
  const fails = Number(await redis.get(`pinfail:${userId}`)) || 0;
  return fails >= MAX_FAILS;
}

export async function recordFailedPin(userId) {
  const key = `pinfail:${userId}`;
  const fails = await redis.incr(key);
  if (fails === 1) await redis.expire(key, LOCK_SECONDS);
}

export async function clearFailedPins(userId) {
  await redis.del(`pinfail:${userId}`);
}
