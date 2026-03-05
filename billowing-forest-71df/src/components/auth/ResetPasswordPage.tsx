import { type FC } from "react";
import AuthLayout from "./AuthLayout";

interface ResetPasswordPageProps {
  token: string;
  error?: string;
}

const ResetPasswordPage: FC<ResetPasswordPageProps> = ({ token, error }) => (
  <AuthLayout title="Reset password">
    <h1 className="auth-heading">Set a new password</h1>
    <p className="auth-sub">Choose a new password for your account.</p>

    {error && <div className="auth-banner auth-banner-error">{error}</div>}

    <form method="POST" action="/api/auth/reset-password">
      <input type="hidden" name="token" value={token} />
      <div className="auth-field">
        <label className="auth-label" htmlFor="password">New password</label>
        <input
          className="auth-input"
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <span style={{ fontSize: 12, color: "var(--muted-2)" }}>Minimum 8 characters</span>
      </div>
      <div className="auth-field">
        <label className="auth-label" htmlFor="confirm_password">Confirm new password</label>
        <input
          className="auth-input"
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <button className="auth-btn" type="submit">Set new password</button>
    </form>

    <div className="auth-links">
      <a className="auth-link" href="/login">Back to sign in</a>
    </div>
  </AuthLayout>
);

export default ResetPasswordPage;
