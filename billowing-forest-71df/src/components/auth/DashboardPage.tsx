import { type FC } from "react";
import AuthLayout from "./AuthLayout";

interface DashboardPageProps {
  user: { id: number; name: string; email: string; role: string };
}

const DashboardPage: FC<DashboardPageProps> = ({ user }) => (
  <AuthLayout title="Dashboard">
    <h1 className="auth-heading">Welcome, {user.name}!</h1>
    <p className="auth-sub">You're a confirmed member of AI Together London.</p>

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
        <div style={{ fontSize: 12, color: "var(--muted-2)", fontWeight: 550, marginBottom: 3 }}>Membership</div>
        <div style={{ fontSize: 15, color: "#2a5f82", fontWeight: 600 }}>Active — confirmed member</div>
      </div>
    </div>

    {user.role === "admin" && (
      <a
        href="/dashboard/admin"
        style={{
          display: "block",
          textAlign: "center",
          padding: "11px 16px",
          borderRadius: 999,
          background: "#2a5f82",
          color: "#fff",
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        Admin panel →
      </a>
    )}

    <a
      href="/"
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
      ← Back to home
    </a>

    <form method="POST" action="/api/auth/logout">
      <button
        type="submit"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          padding: "11px 16px",
          borderRadius: 999,
          border: "1px solid rgba(23,32,42,0.14)",
          background: "rgba(255,255,255,0.5)",
          font: "inherit",
          fontSize: 14,
          fontWeight: 550,
          color: "var(--muted)",
          cursor: "pointer",
          transition: "background 0.14s ease, color 0.14s ease",
        }}
      >
        Sign out
      </button>
    </form>
  </AuthLayout>
);

export default DashboardPage;
