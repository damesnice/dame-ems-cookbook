import crypto from "crypto";
import { isAuthed, setSessionCookie, clearSessionCookie } from "./_auth.js";

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export default function handler(req, res) {
  if (req.method === "GET") {
    res.status(200).json({ authed: isAuthed(req) });
    return;
  }

  if (req.method === "POST") {
    const expectedUsers = (process.env.COOKBOOK_USERNAME || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const expectedPass = process.env.COOKBOOK_PASSWORD;
    if (!expectedUsers.length || !expectedPass) {
      res.status(500).json({ error: "Login isn't configured yet." });
      return;
    }

    const { username, password } = req.body || {};
    const usernameOk =
      typeof username === "string" &&
      expectedUsers.some((u) => timingSafeStringEqual(username, u));
    const ok =
      usernameOk &&
      typeof password === "string" &&
      timingSafeStringEqual(password, expectedPass);

    if (!ok) {
      res.status(401).json({ error: "Wrong username or password." });
      return;
    }

    setSessionCookie(res);
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "DELETE") {
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
    return;
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  res.status(405).json({ error: "Method not allowed" });
}
