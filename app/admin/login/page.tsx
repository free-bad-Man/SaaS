import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./LoginForm";
import "../leads/admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Sign In — 3VE.4",
  description: "Protected 3VE.4 operator access.",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return <main className="admin-page admin-login-page">
    <header className="admin-topbar"><div className="admin-shell admin-nav">
      <Link className="admin-brand" href="/"><span>3V</span><b>3VE.4</b></Link>
      <div className="admin-product"><i /> SECURE ACCESS <small>OWNER ONLY</small></div>
      <div className="admin-nav-actions"><Link href="/platform">Platform</Link></div>
    </div></header>
    <section className="admin-login-shell">
      <div className="admin-login-copy"><p>PRIVATE CONTROL PLANE</p><h1>Operator access.</h1><span>Sign in to unlock projects, real-data processing, policies, run history, and the private lead inbox.</span></div>
      <LoginForm />
      <div className="admin-login-security"><i /><span>Private transport required</span><p>Until HTTPS is enabled, this login is available only through the encrypted owner tunnel.</p></div>
    </section>
  </main>;
}

