import { type FC } from "react";
import AuthLayout from "./AuthLayout";

interface LoginPageProps {
  error?: string;
  confirmed?: boolean;
  values?: { email?: string };
}

const LoginPage: FC<LoginPageProps> = ({ error, confirmed, values = {} }) => (
  <AuthLayout title="Sign in">
    <h1 className="auth-heading">Sign in</h1>
    <p className="auth-sub">Welcome back to AI Together.</p>

    {confirmed && (
      <div className="auth-banner auth-banner-success">
        Email confirmed! You can now sign in.
      </div>
    )}
    {error && <div className="auth-banner auth-banner-error">{error}</div>}

    <form method="POST" action="/api/auth/login">
      <div className="auth-field">
        <label className="auth-label" htmlFor="email">Email</label>
        <input
          className="auth-input"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={values.email}
        />
      </div>
      <div className="auth-field">
        <label className="auth-label" htmlFor="password">Password</label>
        <input
          className="auth-input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button className="auth-btn" type="submit">Sign in</button>
    </form>

    <div className="auth-links">
      <a className="auth-link" href="/forgot-password">Forgot your password?</a>
      <span>No account? <a className="auth-link" href="/signup">Sign up</a></span>
    </div>
  </AuthLayout>
);

export default LoginPage;
