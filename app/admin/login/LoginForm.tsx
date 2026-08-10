"use client";

import { FormEvent, useEffect, useState } from "react";

function safeReturnTo() {
  const value = new URLSearchParams(window.location.search).get("returnTo") ?? "/admin";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/admin";
}

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "submitting" | "error" | "unconfigured">("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" }).then(async (response) => {
      const body = await response.json() as { authenticated?: boolean; configured?: boolean };
      if (!active) return;
      if (body.authenticated) window.location.replace(safeReturnTo());
      else setState(body.configured ? "idle" : "unconfigured");
    }).catch(() => { if (active) { setState("error"); setMessage("The authentication service is unavailable."); } });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Sign in failed.");
      window.location.replace(safeReturnTo());
    } catch (error) {
      setPassword("");
      setState("error");
      setMessage(error instanceof Error ? error.message : "Sign in failed.");
    }
  }

  return <form className="admin-login-card" onSubmit={submit}>
    <div className="admin-login-card-head"><span>ADMIN SESSION</span><b>Authenticate</b><small>Session lifetime · 8 hours</small></div>
    <label><span>Username</span><input name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} disabled={state === "checking" || state === "submitting" || state === "unconfigured"} required /></label>
    <label><span>Password</span><input name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={state === "checking" || state === "submitting" || state === "unconfigured"} required /></label>
    {state === "error" ? <p className="admin-login-error" role="alert">{message}</p> : null}
    {state === "unconfigured" ? <p className="admin-login-error" role="alert">Admin credentials have not been configured on this server.</p> : null}
    <button type="submit" disabled={state === "checking" || state === "submitting" || state === "unconfigured" || !username || !password}>{state === "checking" ? "Checking access…" : state === "submitting" ? "Signing in…" : "Open control plane →"}</button>
    <footer><span><i /> HttpOnly session</span><span>Rate limited</span><span>Server verified</span></footer>
  </form>;
}
