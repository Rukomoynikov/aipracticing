import { type FC } from "react";
import AuthLayout from "./AuthLayout";

interface ForgotPasswordPageProps {
  error?: string;
  sent?: boolean;
}

const ForgotPasswordPage: FC<ForgotPasswordPageProps> = ({ error, sent }) => (
  <AuthLayout title="Forgot password">
    <h1 className="auth-heading">Forgot your password?</h1>
    <p className="auth-sub">Enter your email and we'll send you a reset link.</p>

    {sent && (
      <div className="auth-banner auth-banner-success">
        If that email is registered, you'll receive a reset link shortly.
      </div>
    )}
    {error && <div className="auth-banner auth-banner-error">{error}</div>}

    {!sent && (
      <form method="POST" action="/api/auth/forgot-password">
        <div className="auth-field">
          <label className="auth-label" htmlFor="email">Email</label>
          <input
            className="auth-input"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <button className="auth-btn" type="submit">Send reset link</button>
      </form>
    )}

    <div className="auth-links">
      <a className="auth-link" href="/login">Back to sign in</a>
    </div>
  </AuthLayout>
);

export default ForgotPasswordPage;
