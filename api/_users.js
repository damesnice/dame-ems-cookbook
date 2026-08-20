import { Redis } from "@upstash/redis";
import { defaultUsers } from "./_default-users.js";

const redis = Redis.fromEnv();
const KEY = "users";

export async function getUsers() {
  const users = await redis.get(KEY);
  if (users && Array.isArray(users) && users.length) return users;
  const seeded = defaultUsers();
  await redis.set(KEY, seeded);
  return seeded;
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
