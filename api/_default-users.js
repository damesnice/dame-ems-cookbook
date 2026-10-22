// Seeded the first time /api/login (or any authed route) reads "users" and
// nothing's been saved yet — mirrors _default-pantry.js's seed-once pattern.
// Once anything is saved to the "users" key, COOKBOOK_USERNAME has no further
// effect. Seeded accounts have no PIN and can't log in until
// COOKBOOK_ACCOUNTS gives them one (see applyAccountSetup in _users.js).
import crypto from "crypto";

function uid() {
  return crypto.randomBytes(6).toString("hex");
}

export function defaultUsers() {
  const names = (process.env.COOKBOOK_USERNAME || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const now = new Date().toISOString();

  return names.map((name) => ({
    id: uid(),
    name,
    email: `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}@local.invalid`,
    mfa: { method: null },
    webauthn: { credentials: [] },
    createdAt: now,
    updatedAt: now,
  }));
}
