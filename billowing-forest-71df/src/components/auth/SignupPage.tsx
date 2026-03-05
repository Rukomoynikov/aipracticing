import { type FC } from "react";
import AuthLayout from "./AuthLayout";

interface SignupPageProps {
  error?: string;
  values?: { name?: string; email?: string };
}

const SignupPage: FC<SignupPageProps> = ({ error, values = {} }) => (
  <AuthLayout title="Sign up">
    <h1 className="auth-heading">Create your account</h1>
    <p className="auth-sub">Join the AI Together London community.</p>

    {error && <div className="auth-banner auth-banner-error">{error}</div>}

    <form method="POST" action="/api/auth/signup">
      <div className="auth-field">
        <label className="auth-label" htmlFor="name">Name</label>
        <input
          className="auth-input"
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          defaultValue={values.name}
        />
      </div>
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
          autoComplete="new-password"
          required
          minLength={8}
        />
        <span style={{ fontSize: 12, color: "var(--muted-2)" }}>Minimum 8 characters</span>
      </div>
      <div className="auth-field">
        <label className="auth-label" htmlFor="confirm_password">Confirm password</label>
        <input
          className="auth-input"
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <button className="auth-btn" type="submit">Create account</button>
    </form>

    <div className="auth-links">
      <span>Already have an account? <a className="auth-link" href="/login">Sign in</a></span>
    </div>
  </AuthLayout>
);

export default SignupPage;
