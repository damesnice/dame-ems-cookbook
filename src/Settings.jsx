import { useEffect, useRef, useState } from "react";
import { Button, COLORS, Field, inputStyle } from "./ui.jsx";

// ---------- API helpers ----------

async function jsonFetch(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

const updateAccount = (patch) =>
  jsonFetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });

const changePassword = (currentPassword, newPassword) =>
  jsonFetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });

const startTotpEnroll = () =>
  jsonFetch("/api/account-mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "totp" }) });

const confirmTotpEnroll = (confirmCode) =>
  jsonFetch("/api/account-mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "totp", confirmCode }) });

const startEmailEnroll = () =>
  jsonFetch("/api/account-mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "email" }) });

const confirmEmailEnroll = (confirmCode) =>
  jsonFetch("/api/account-mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "email", confirmCode }) });

const disableMfa = (currentPassword) =>
  jsonFetch("/api/account-mfa", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword }) });

async function registerPasskey() {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const optionsJSON = await jsonFetch("/api/passkey?action=register");
  const response = await startRegistration({ optionsJSON });
  return jsonFetch("/api/passkey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "register", ...response }) });
}

const fetchAudit = (type, limit = 30) => jsonFetch(`/api/audit?type=${type}&limit=${limit}`);

const restoreAuditEntry = (type, entryId) =>
  jsonFetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, entryId }) });

// ---------- accordion shell ----------

function AccordionItem({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.line}` }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          background: "transparent",
          border: "none",
          padding: "13px 2px",
          cursor: "pointer",
          fontFamily: "'Fraunces', serif",
          fontSize: 15,
          fontWeight: 500,
          color: COLORS.ink,
          textAlign: "left",
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 12, color: COLORS.inkSoft, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
      </button>
      {open && <div style={{ padding: "0 2px 16px" }}>{children}</div>}
    </div>
  );
}

function Msg({ text, tone = "error" }) {
  if (!text) return null;
  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 12.5,
        marginTop: 10,
        color: tone === "error" ? "var(--c-danger)" : COLORS.moss,
      }}
    >
      {text}
    </div>
  );
}

// ---------- Account section ----------

function AccountSection({ currentUser, onUserUpdate }) {
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);

  async function saveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const updated = await updateAccount({ name: name.trim(), email: email.trim() });
      onUserUpdate(updated);
      setProfileMsg({ text: "Saved.", tone: "ok" });
    } catch (err) {
      setProfileMsg({ text: err.message, tone: "error" });
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMsg({ text: "Password changed.", tone: "ok" });
    } catch (err) {
      setPasswordMsg({ text: err.message, tone: "error" });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.inkSoft, margin: "0 0 14px" }}>
        Name and email are how you&rsquo;re identified in the activity log and how Face ID/MFA are tied to you specifically.
      </p>
      <form onSubmit={saveProfile} style={{ marginBottom: 22 }}>
        <Field label="Name">
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </Field>
        <Button type="submit" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"}</Button>
        <Msg text={profileMsg?.text} tone={profileMsg?.tone} />
      </form>

      <div style={{ borderTop: `1px solid ${COLORS.line}`, paddingTop: 16 }}>
        <form onSubmit={savePassword}>
          <Field label="Current password">
            <input style={inputStyle} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="New password">
            <input style={inputStyle} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <Button type="submit" variant="ghost" disabled={savingPassword}>{savingPassword ? "Saving…" : "Change password"}</Button>
          <Msg text={passwordMsg?.text} tone={passwordMsg?.tone} />
        </form>
      </div>
    </div>
  );
}

// ---------- Two-factor section ----------

function TwoFactorSection({ currentUser, onUserUpdate }) {
  const [method, setMethod] = useState(currentUser.mfaMethod);
  const [pendingMethod, setPendingMethod] = useState(null); // "totp" | "email" while mid-enrollment
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function beginTotp() {
    setBusy(true);
    setMsg(null);
    try {
      const data = await startTotpEnroll();
      setSecret(data);
      setPendingMethod("totp");
    } catch (err) {
      setMsg({ text: err.message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function beginEmail() {
    setBusy(true);
    setMsg(null);
    try {
      await startEmailEnroll();
      setPendingMethod("email");
      setMsg({ text: "Code sent — check your email.", tone: "ok" });
    } catch (err) {
      setMsg({ text: err.message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setMsg(null);
    try {
      const updated = pendingMethod === "totp" ? await confirmTotpEnroll(code.trim()) : await confirmEmailEnroll(code.trim());
      onUserUpdate(updated);
      setMethod(updated.mfaMethod);
      setPendingMethod(null);
      setSecret(null);
      setCode("");
      setMsg({ text: "Two-factor enabled.", tone: "ok" });
    } catch (err) {
      setMsg({ text: err.message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const updated = await disableMfa(password);
      onUserUpdate(updated);
      setMethod(null);
      setPassword("");
      setMsg({ text: "Two-factor disabled.", tone: "ok" });
    } catch (err) {
      setMsg({ text: err.message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (method) {
    return (
      <div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.inkSoft, margin: "0 0 14px" }}>
          Currently on: {method === "totp" ? "authenticator app" : "email codes"}.
        </p>
        <Field label="Current password (to disable)">
          <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <Button variant="danger" onClick={disable} disabled={busy}>{busy ? "Working…" : "Disable two-factor"}</Button>
        <Msg text={msg?.text} tone={msg?.tone} />
      </div>
    );
  }

  if (pendingMethod) {
    return (
      <div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.inkSoft, margin: "0 0 14px" }}>
          {pendingMethod === "totp" ? "Add this secret to your authenticator app, then enter the current code to confirm." : "Enter the code we emailed you to confirm."}
        </p>
        {secret && (
          <div style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: "10px 12px", marginBottom: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, wordBreak: "break-all" }}>
            {secret.secret}
          </div>
        )}
        <Field label="6-digit code">
          <input
            style={{ ...inputStyle, letterSpacing: "0.2em", textAlign: "center", fontSize: 18 }}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
          />
        </Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={confirm} disabled={busy}>{busy ? "Verifying…" : "Confirm"}</Button>
          <Button variant="ghost" onClick={() => { setPendingMethod(null); setSecret(null); setCode(""); setMsg(null); }}>Cancel</Button>
        </div>
        <Msg text={msg?.text} tone={msg?.tone} />
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.inkSoft, margin: "0 0 14px" }}>
        Add a second step at login, on top of your password.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button onClick={beginTotp} disabled={busy}>Use an authenticator app</Button>
        <Button variant="ghost" onClick={beginEmail} disabled={busy}>Use email codes</Button>
      </div>
      <Msg text={msg?.text} tone={msg?.tone} />
    </div>
  );
}

// ---------- Face ID section ----------

function FaceIdSection({ currentUser, onUserUpdate }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function register() {
    setBusy(true);
    setMsg(null);
    try {
      const updated = await registerPasskey();
      onUserUpdate(updated);
      setMsg({ text: "Passkey registered.", tone: "ok" });
    } catch (err) {
      setMsg({ text: err.message || "Couldn't register a passkey.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.inkSoft, margin: "0 0 14px" }}>
        Registers this device&rsquo;s Face ID / Touch ID as a passkey — sign in with biometrics instead of your password.
      </p>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 12 }}>
        {currentUser.passkeyCount > 0
          ? `${currentUser.passkeyCount} passkey${currentUser.passkeyCount > 1 ? "s" : ""} registered on this account.`
          : "No passkeys registered yet."}
      </div>
      <Button onClick={register} disabled={busy}>{busy ? "Waiting for Face ID…" : "🔐 Register this device"}</Button>
      <Msg text={msg?.text} tone={msg?.tone} />
    </div>
  );
}

// ---------- Activity & restore section ----------

const AUDIT_TYPES = [
  { value: "families", label: "Recipes" },
  { value: "pantry", label: "Pantry" },
  { value: "mealplan", label: "Meal plan" },
];

function describeEntry(entry) {
  if (entry.type === "families") {
    const label = entry.after?.name || entry.before?.name || "a recipe";
    if (entry.action === "create") return `created ${label}`;
    if (entry.action === "delete") return `deleted ${label}`;
    if (entry.action === "restore") return `restored ${label}`;
    return `edited ${label}`;
  }
  const noun = entry.type === "pantry" ? "the pantry" : "the meal plan";
  if (entry.action === "restore") return `restored ${noun}`;
  return `updated ${noun}`;
}

function ActivitySection() {
  const [type, setType] = useState("families");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAudit(type)
      .then((data) => {
        if (!cancelled) setEntries(data.entries || []);
      })
      .catch((err) => {
        if (!cancelled) setMsg({ text: err.message, tone: "error" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  async function restore(entry) {
    if (!window.confirm(`Restore this? This will overwrite the current version of ${entry.type === "families" ? entry.after?.name || entry.before?.name || "this recipe" : type}.`)) {
      return;
    }
    setRestoringId(entry.id);
    setMsg(null);
    try {
      await restoreAuditEntry(type, entry.id);
      const data = await fetchAudit(type);
      setEntries(data.entries || []);
      setMsg({ text: "Restored.", tone: "ok" });
    } catch (err) {
      setMsg({ text: err.message, tone: "error" });
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.inkSoft, margin: "0 0 14px" }}>
        Every edit and delete is kept — nothing here ever expires. Restore reverts just that item.
      </p>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {AUDIT_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 20,
              border: `1px solid ${t.value === type ? COLORS.plum : COLORS.line}`,
              background: t.value === type ? COLORS.plum : "transparent",
              color: t.value === type ? "var(--c-onAccent)" : COLORS.ink,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.inkSoft }}>Loading…</div>}
      {!loading && entries.length === 0 && (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.inkSoft }}>No activity yet.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.map((entry) => (
          <div
            key={entry.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              background: COLORS.paper,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 4,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
            }}
          >
            <div>
              <strong>{entry.userName}</strong> {describeEntry(entry)}
              <div style={{ color: COLORS.inkSoft, fontSize: 11 }}>{new Date(entry.at).toLocaleString()}</div>
            </div>
            {entry.action !== "restore" && (
              <Button variant="ghost" style={{ fontSize: 11, padding: "5px 9px", flexShrink: 0 }} onClick={() => restore(entry)} disabled={restoringId === entry.id}>
                {restoringId === entry.id ? "Restoring…" : "Restore"}
              </Button>
            )}
          </div>
        ))}
      </div>
      <Msg text={msg?.text} tone={msg?.tone} />
    </div>
  );
}

// ---------- root: a dropdown menu, top-right, each section its own accordion ----------

export default function SettingsMenu({ currentUser, onUserUpdate }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!currentUser) return null;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account settings"
        title="Account settings"
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: `2px solid ${open ? COLORS.plum : COLORS.mustard}`,
          background: COLORS.card,
          color: COLORS.ink,
          fontFamily: "'Fraunces', serif",
          fontSize: 17,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "border-color 0.15s",
        }}
      >
        🍁
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 340,
            maxWidth: "90vw",
            maxHeight: "75vh",
            overflowY: "auto",
            background: COLORS.card,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 8,
            boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
            padding: "6px 16px",
            zIndex: 50,
          }}
        >
          <AccordionItem title="Your account" defaultOpen>
            <AccountSection currentUser={currentUser} onUserUpdate={onUserUpdate} />
          </AccordionItem>
          <AccordionItem title="Two-factor authentication">
            <TwoFactorSection currentUser={currentUser} onUserUpdate={onUserUpdate} />
          </AccordionItem>
          <AccordionItem title="Face ID">
            <FaceIdSection currentUser={currentUser} onUserUpdate={onUserUpdate} />
          </AccordionItem>
          <AccordionItem title="Activity & restore">
            <ActivitySection />
          </AccordionItem>
        </div>
      )}
    </div>
  );
}
