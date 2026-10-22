import { Redis } from "@upstash/redis";
import crypto from "crypto";
import { defaultUsers } from "./_default-users.js";
import { hashPassword } from "./_passwords.js";

const redis = Redis.fromEnv();
const KEY = "users";

export async function getUsers() {
  const users = await redis.get(KEY);
  if (users && Array.isArray(users) && users.length) return applyAccountSetup(users);
  const seeded = defaultUsers();
  await redis.set(KEY, seeded);
  return applyAccountSetup(seeded);
}

// One-time account reset, for when nobody can log in: COOKBOOK_ACCOUNTS is
// "Name:PIN,Name:PIN". Each entry renames and re-PINs the account with that
// name, or failing that the only account whose name starts with the same
// letter (so "Dame" finds an account still called "Damon"). A given value is
// applied once (tracked by its hash), so later PIN changes from Settings
// aren't undone. Remove the env var once it's been applied.
async function applyAccountSetup(users) {
  const raw = process.env.COOKBOOK_ACCOUNTS;
  if (!raw) return users;
  const doneKey = `accounts-applied:${crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
  if (await redis.get(doneKey)) return users;

  const now = new Date().toISOString();
  for (const entry of raw.split(",")) {
    const [name, pin] = entry.split(":").map((s) => (s || "").trim());
    if (!name || !/^\d{4,8}$/.test(pin)) continue;
    const lower = name.toLowerCase();
    const sameInitial = users.filter((u) => u.name.toLowerCase()[0] === lower[0]);
    const user = users.find((u) => u.name.toLowerCase() === lower) || (sameInitial.length === 1 ? sameInitial[0] : null);
    if (!user) continue;
    user.name = name;
    user.pinHash = hashPassword(pin);
    delete user.passwordHash;
    user.updatedAt = now;
  }
  await redis.set(KEY, users);
  await redis.set(doneKey, now);
  return users;
}

export async function saveUsers(users) {
  await redis.set(KEY, users);
}

export function findByIdentifier(users, identifier) {
  const needle = String(identifier || "").trim().toLowerCase();
  if (!needle) return null;
  return (
    users.find((u) => u.name.toLowerCase() === needle || u.email.toLowerCase() === needle) || null
  );
}

export function findById(users, id) {
  return users.find((u) => u.id === id) || null;
}

export function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mfaMethod: user.mfa?.method || null,
    passkeyCount: user.webauthn?.credentials?.length || 0,
  };
}
