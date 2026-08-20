import crypto from "crypto";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const TTL = 60 * 10; // 10 minutes

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function issueEmailOTP(userId) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await redis.set(`otp:${userId}`, { codeHash: hashCode(code), attempts: 0 }, { ex: TTL });
  return code;
}

export async function verifyEmailOTP(userId, code) {
  const key = `otp:${userId}`;
  const entry = await redis.get(key);
  if (!entry) return false;
  if (entry.attempts >= 5) {
    await redis.del(key);
    return false;
  }
  const ok = entry.codeHash === hashCode(String(code || ""));
  if (ok) {
    await redis.del(key);
    return true;
  }
  await redis.set(key, { ...entry, attempts: entry.attempts + 1 }, { ex: TTL });
  return false;
}
