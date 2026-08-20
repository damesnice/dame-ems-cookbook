import crypto from "crypto";
import { Redis } from "@upstash/redis";
import { findById, getUsers } from "./_users.js";

const redis = Redis.fromEnv();

export const COOKIE_NAME = "cookbook_session";
export const PENDING_COOKIE_NAME = "cookbook_mfa_pending";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, seconds
const PENDING_MAX_AGE = 60 * 5; // 5 minutes, seconds

const SECURE = process.env.LOCAL_PREVIEW ? "" : "Secure; ";

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await redis.set(
    `session:${token}`,
    { userId, createdAt: new Date().toISOString() },
    { ex: SESSION_MAX_AGE }
  );
  return token;
}

export function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; ${SECURE}SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; ${SECURE}SameSite=Lax; Path=/; Max-Age=0`);
}

export async function requireUser(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;
  const session = await redis.get(`session:${token}`);
  if (!session || !session.userId) return null;
  const users = await getUsers();
  const user = findById(users, session.userId);
  return user || null;
}

function pendingSecret() {
  const secret = process.env.COOKBOOK_SESSION_SECRET;
  if (!secret) throw new Error("COOKBOOK_SESSION_SECRET is not set");
  return secret;
}

function signPendingPayload(payload) {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = crypto.createHmac("sha256", pendingSecret()).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

export function setPendingMfaCookie(res, userId, method) {
  const exp = Date.now() + PENDING_MAX_AGE * 1000;
  const value = signPendingPayload({ userId, method, exp });
  res.setHeader(
    "Set-Cookie",
    `${PENDING_COOKIE_NAME}=${value}; HttpOnly; ${SECURE}SameSite=Lax; Path=/; Max-Age=${PENDING_MAX_AGE}`
  );
}

export function clearPendingMfaCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${PENDING_COOKIE_NAME}=; HttpOnly; ${SECURE}SameSite=Lax; Path=/; Max-Age=0`
  );
}

export function readPendingMfa(req) {
  const value = parseCookies(req)[PENDING_COOKIE_NAME];
  if (!value) return null;
  const [b64, sig] = value.split(".");
  if (!b64 || !sig) return null;
  const expectedSig = crypto.createHmac("sha256", pendingSecret()).update(b64).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(b64, "base64url").toString());
  } catch {
    return null;
  }
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}
