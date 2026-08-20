import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { requireUser } from "./_auth.js";
import { findById, getUsers, saveUsers, sanitizeUser } from "./_users.js";
import { origin, rpID, rpName, storeChallenge, takeChallenge } from "./_webauthn.js";

export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  if (req.method === "GET") {
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email,
      userDisplayName: user.name,
      userID: new TextEncoder().encode(user.id),
      attestationType: "none",
      excludeCredentials: (user.webauthn?.credentials || []).map((c) => ({
        id: c.id,
        transports: c.transports,
      })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });
    await storeChallenge(user.id, options.challenge);
    res.status(200).json(options);
    return;
  }

  if (req.method === "POST") {
    const expectedChallenge = await takeChallenge(user.id);
    if (!expectedChallenge) {
      res.status(400).json({ error: "Registration expired — try again." });
      return;
    }
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: req.body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch (err) {
      res.status(400).json({ error: err.message || "Couldn't verify that passkey." });
      return;
    }
    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: "Couldn't verify that passkey." });
      return;
    }

    const { credential } = verification.registrationInfo;
    const users = await getUsers();
    const current = findById(users, user.id);
    current.webauthn = current.webauthn || { credentials: [] };
    current.webauthn.credentials.push({
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports || [],
      deviceLabel: "Passkey",
      createdAt: new Date().toISOString(),
    });
    current.updatedAt = new Date().toISOString();
    await saveUsers(users);
    res.status(200).json(sanitizeUser(current));
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed" });
}
