import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { createSession, setSessionCookie } from "./_auth.js";
import { findByIdentifier, findById, getUsers, saveUsers, sanitizeUser } from "./_users.js";
import { origin, rpID, storeChallenge, takeChallenge } from "./_webauthn.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { identifier } = req.query || {};
    const users = await getUsers();
    const user = findByIdentifier(users, identifier || "");
    const credentials = user?.webauthn?.credentials || [];
    if (!user || credentials.length === 0) {
      res.status(404).json({ error: "No passkey registered for that account." });
      return;
    }
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: credentials.map((c) => ({ id: c.id, transports: c.transports })),
      userVerification: "preferred",
    });
    await storeChallenge(`login:${user.id}`, options.challenge);
    res.status(200).json({ ...options, userId: user.id });
    return;
  }

  if (req.method === "POST") {
    const { userId, response } = req.body || {};
    if (!userId || !response) {
      res.status(400).json({ error: "Missing userId or response." });
      return;
    }
    const expectedChallenge = await takeChallenge(`login:${userId}`);
    if (!expectedChallenge) {
      res.status(400).json({ error: "Sign-in expired — try again." });
      return;
    }
    const users = await getUsers();
    const user = findById(users, userId);
    const stored = user?.webauthn?.credentials?.find((c) => c.id === response.id);
    if (!user || !stored) {
      res.status(400).json({ error: "Unknown passkey." });
      return;
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: stored.id,
          publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
          counter: stored.counter,
          transports: stored.transports,
        },
      });
    } catch (err) {
      res.status(400).json({ error: err.message || "Couldn't verify that passkey." });
      return;
    }
    if (!verification.verified) {
      res.status(400).json({ error: "Couldn't verify that passkey." });
      return;
    }

    stored.counter = verification.authenticationInfo.newCounter;
    await saveUsers(users);

    const token = await createSession(user.id);
    setSessionCookie(res, token);
    res.status(200).json({ ok: true, user: sanitizeUser(user) });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed" });
}
