// Seeded the first time /api/login (or any authed route) reads "users" and
// nothing's been saved yet — mirrors _default-pantry.js's seed-once pattern.
// Once anything is saved to the "users" key, COOKBOOK_USERNAME/PASSWORD have
// no further effect; credentials live in Redis and are self-managed from
// Settings after this point.
import crypto from "crypto";
import { hashPassword } from "./_passwords.js";

function uid() {
  return crypto.randomBytes(6).toString("hex");
}

export function defaultUsers() {
  const names = (process.env.COOKBOOK_USERNAME || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const password = process.env.COOKBOOK_PASSWORD || "";
  const now = new Date().toISOString();

  return names.map((name) => ({
    id: uid(),
    name,
    email: `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}@local.invalid`,
    passwordHash: hashPassword(password),
    mfa: { method: null },
    webauthn: { credentials: [] },
    createdAt: now,
    updatedAt: now,
  }));
}
