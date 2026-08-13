import crypto from "crypto";

export const COOKIE_NAME = "cookbook_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function sessionToken() {
  const secret = process.env.COOKBOOK_SESSION_SECRET;
  if (!secret) throw new Error("COOKBOOK_SESSION_SECRET is not set");
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function setSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${sessionToken()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

export function isAuthed(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  const expected = Buffer.from(sessionToken());
  const actual = Buffer.from(match[1]);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
