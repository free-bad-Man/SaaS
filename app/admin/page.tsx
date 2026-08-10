import type { Metadata } from "next";
import AdminControlCenter from "./AdminControlCenter";
import "./leads/admin.css";
import "./control.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Control Center — 3VE.4",
  description: "Private 3VE.4 operations and account management.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminControlCenter />;
}
