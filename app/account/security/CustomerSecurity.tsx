"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Viewer = { email: string; role: string; plan: string; mustChangePassword: boolean };

function safeReturnTo() {
  const value = new URLSearchParams(window.location.search).get("returnTo") ?? "/platform";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/platform";
}

export default function CustomerSecurity() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<"checking" | "idle" | "submitting" | "complete" | "error">("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/customer-auth/session", { cache: "no-store" }).then(async (response) => {
      const body = await response.json() as { authenticated?: boolean; viewer?: Viewer };
      if (!active) return;
      if (!response.ok || !body.authenticated || !body.viewer) window.location.replace(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      else { setViewer(body.viewer); setState("idle"); }
    }).catch(() => { if (active) { setState("error"); setMessage("Account security could not be loaded."); } });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmation) { setState("error"); setMessage("New passwords do not match."); return; }
    setState("submitting");
    setMessage("");
    try {
      const response = await fetch("/api/customer-auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await response.json() as { error?: string; viewer?: Viewer };
      if (!response.ok || !body.viewer) throw new Error(body.error ?? "Password could not be changed.");
      setViewer(body.viewer);
      setCurrentPassword(""); setNewPassword(""); setConfirmation("");
      setState("complete");
      window.setTimeout(() => window.location.replace(safeReturnTo()), 900);
    } catch (caught) {
      setState("error");
      setMessage(caught instanceof Error ? caught.message : "Password could not be changed.");
    }
  }

  async function signOut() {
    await fetch("/api/customer-auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  const disabled = state === "checking" || state === "submitting" || state === "complete";
  return <main className="client-auth-page security-page">
    <header className="client-auth-nav"><Link href="/"><span>3V</span><b>3VE.4</b></Link><div><i /> ACCOUNT SECURITY</div><button type="button" onClick={() => void signOut()}>Sign out</button></header>
    <section className="security-shell">
      <div className="security-summary"><p>{viewer?.mustChangePassword ? "FIRST SIGN-IN" : "CUSTOMER ACCOUNT"}</p><h1>{viewer?.mustChangePassword ? "Secure your workspace." : "Change your password."}</h1><span>{viewer?.mustChangePassword ? "Replace the one-time password before processing any customer data." : "Updating your password revokes every other active customer session."}</span><div><span>IDENTITY <b>{viewer?.email ?? "Checking…"}</b></span><span>ACCESS <b>{viewer ? `${viewer.plan.toUpperCase()} · ${viewer.role.toUpperCase()}` : "—"}</b></span></div></div>
      <form className="client-auth-card security-card" onSubmit={submit}>
        <header><span>SECURITY CHECK</span><h2>Set a private password</h2><p>At least 14 characters with uppercase, lowercase, number, and symbol.</p></header>
        <label><span>Current or temporary password</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required disabled={disabled} /></label>
        <label><span>New password</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={14} required disabled={disabled} /></label>
        <label><span>Confirm new password</span><input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={14} required disabled={disabled} /></label>
        {state === "error" ? <p className="client-auth-error" role="alert">{message}</p> : null}
        {state === "complete" ? <p className="client-auth-success" role="status">Password updated. Opening your workspace…</p> : null}
        <button type="submit" disabled={disabled || !currentPassword || !newPassword || !confirmation}>{state === "checking" ? "Checking session…" : state === "submitting" ? "Updating security…" : state === "complete" ? "Password updated ✓" : "Save and continue →"}</button>
        <footer><span>Other sessions revoked</span><span>No plaintext storage</span></footer>
      </form>
    </section>
  </main>;
}
