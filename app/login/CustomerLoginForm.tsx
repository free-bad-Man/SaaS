"use client";

import Link from "next/link";
import VerdictMark from "@/app/components/VerdictMark";
import { FormEvent, useEffect, useState } from "react";

type Viewer = { email: string; mustChangePassword: boolean };

function safeReturnTo() {
  const value = new URLSearchParams(window.location.search).get("returnTo") ?? "/platform";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/platform";
}

export default function CustomerLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"checking" | "idle" | "submitting" | "error" | "unconfigured">("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/customer-auth/session", { cache: "no-store" }).then(async (response) => {
      const body = await response.json() as { authenticated?: boolean; configured?: boolean; viewer?: Viewer };
      if (!active) return;
      if (body.authenticated && body.viewer) {
        window.location.replace(body.viewer.mustChangePassword ? `/account/security?returnTo=${encodeURIComponent(safeReturnTo())}` : safeReturnTo());
      } else setState(body.configured === false ? "unconfigured" : "idle");
    }).catch(() => { if (active) { setState("error"); setMessage("The sign-in service is temporarily unavailable."); } });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");
    try {
      const response = await fetch("/api/customer-auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json() as { error?: string; viewer?: Viewer };
      if (!response.ok || !body.viewer) throw new Error(body.error ?? "Sign in failed.");
      const returnTo = safeReturnTo();
      window.location.replace(body.viewer.mustChangePassword ? `/account/security?returnTo=${encodeURIComponent(returnTo)}` : returnTo);
    } catch (caught) {
      setPassword("");
      setState("error");
      setMessage(caught instanceof Error ? caught.message : "Sign in failed.");
    }
  }

  const disabled = state === "checking" || state === "submitting" || state === "unconfigured";
  return <main className="client-auth-page">
    <header className="client-auth-nav"><Link href="/"><VerdictMark /><b>Verdict</b></Link><div><i /> SECURE CUSTOMER ACCESS</div><a href="https://adminez.sh/" target="_blank" rel="noreferrer">Request a pilot ↗</a></header>
    <section className="client-auth-shell">
      <div className="client-auth-copy"><p>PRIVATE ADTECH WORKSPACE</p><h1>Continue to your control plane.</h1><span>Open your projects, process approved datasets, review decisions, and export reproducible results.</span><div className="client-auth-proof"><span><i /> Isolated workspace</span><span><i /> Encrypted transport</span><span><i /> Metered access</span></div></div>
      <form className="client-auth-card" onSubmit={submit}>
        <header><span>CUSTOMER SESSION</span><h2>Sign in</h2><p>Use the credentials issued by your Verdict operator.</p></header>
        <label><span>Work email</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required disabled={disabled} /></label>
        <label><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={disabled} /></label>
        {state === "error" ? <p className="client-auth-error" role="alert">{message}</p> : null}
        {state === "unconfigured" ? <p className="client-auth-error" role="alert">Customer access is not configured on this server.</p> : null}
        <button type="submit" disabled={disabled || !email || !password}>{state === "checking" ? "Checking session…" : state === "submitting" ? "Signing in…" : "Open workspace →"}</button>
        <footer><span>Invite-only access</span><span>24-hour session</span><span>HttpOnly cookie</span></footer>
      </form>
    </section>
  </main>;
}
