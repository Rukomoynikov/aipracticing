import { type FC } from "react";
import AuthLayout from "./AuthLayout";

interface AdminDashboardPageProps {
  user: { id: number; name: string; email: string; role: string };
}

const AdminDashboardPage: FC<AdminDashboardPageProps> = ({ user }) => (
  <AuthLayout title="Admin">
    <h1 className="auth-heading">Admin Panel</h1>
    <p className="auth-sub">You have administrator access.</p>

    <div
      style={{
        background: "rgba(60,137,182,0.07)",
        border: "1px solid rgba(60,137,182,0.15)",
        borderRadius: 14,
        padding: "20px 20px",
        marginBottom: 20,
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: "var(--muted-2)", fontWeight: 550, marginBottom: 3 }}>Name</div>
        <div style={{ fontSize: 15, color: "var(--ink)", fontWeight: 500 }}>{user.name}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: "var(--muted-2)", fontWeight: 550, marginBottom: 3 }}>Email</div>
        <div style={{ fontSize: 15, color: "var(--ink)", fontWeight: 500 }}>{user.email}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: "var(--muted-2)", fontWeight: 550, marginBottom: 3 }}>Role</div>
        <div style={{ fontSize: 15, color: "#2a5f82", fontWeight: 600 }}>Admin</div>
      </div>
    </div>

    <a
      href="/dashboard"
      style={{
        display: "block",
        textAlign: "center",
        padding: "10px",
        fontSize: 14,
        color: "var(--muted)",
        textDecoration: "none",
        marginBottom: 6,
      }}
    >
      ← Back to dashboard
    </a>
  </AuthLayout>
);

export default AdminDashboardPage;
