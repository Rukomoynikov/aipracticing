import { type FC, type ReactNode } from "react";

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
}

const AuthLayout: FC<AuthLayoutProps> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{`${title} — AI Together`}</title>
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <link rel="stylesheet" href="/styles.css" />
      <style>{`
        .auth-wrap {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 16px;
        }
        .auth-card {
          background: rgba(255,255,255,0.82);
          border: 1px solid rgba(23,32,42,0.09);
          border-radius: 22px;
          padding: 40px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 24px 70px rgba(13,18,24,0.11);
        }
        .auth-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          margin-bottom: 32px;
        }
        .auth-logo-mark {
          display: flex;
          gap: 3px;
          align-items: center;
        }
        .auth-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .auth-dot-a { background: #3c89b6; }
        .auth-dot-b { background: #ff6b5b; }
        .auth-dot-c { background: #ffbf66; }
        .auth-logo-text {
          font-size: 15px;
          font-weight: 650;
          color: var(--ink);
          letter-spacing: -0.3px;
        }
        .auth-heading {
          font-size: 22px;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: -0.5px;
          margin: 0 0 6px;
        }
        .auth-sub {
          font-size: 14px;
          color: var(--muted);
          margin: 0 0 28px;
          line-height: 1.5;
        }
        .auth-field {
          display: grid;
          gap: 6px;
          margin-bottom: 14px;
        }
        .auth-label {
          font-size: 13px;
          color: var(--muted);
          font-weight: 550;
        }
        .auth-input {
          width: 100%;
          font: inherit;
          color: var(--ink);
          padding: 11px 13px;
          border-radius: 12px;
          border: 1px solid rgba(23,32,42,0.14);
          background: rgba(255,255,255,0.7);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.65);
          box-sizing: border-box;
          font-size: 15px;
          transition: border-color 0.14s ease, background 0.14s ease, box-shadow 0.14s ease;
        }
        .auth-input:focus {
          outline: none;
          border-color: rgba(60,137,182,0.5);
          background: rgba(255,255,255,0.9);
          box-shadow: 0 0 0 4px rgba(60,137,182,0.14), inset 0 1px 0 rgba(255,255,255,0.7);
        }
        .auth-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 13px 16px;
          border-radius: 999px;
          border: 1px solid transparent;
          font: inherit;
          font-size: 15px;
          font-weight: 650;
          letter-spacing: -0.01em;
          cursor: pointer;
          margin-top: 20px;
          background: linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,255,255,0.72)) padding-box,
            linear-gradient(135deg, rgba(60,137,182,0.62), rgba(255,107,91,0.55), rgba(255,191,102,0.6)) border-box;
          box-shadow: 0 18px 44px rgba(13,18,24,0.12), inset 0 1px 0 rgba(255,255,255,0.7);
          color: #10212b;
          transition: transform 0.14s ease, box-shadow 0.14s ease;
        }
        .auth-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 22px 54px rgba(13,18,24,0.14), inset 0 1px 0 rgba(255,255,255,0.72);
        }
        .auth-links {
          margin-top: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
          font-size: 13px;
          color: var(--muted);
        }
        .auth-link {
          color: var(--muted);
          text-decoration: none;
          border-bottom: 1px solid rgba(23,32,42,0.18);
          padding-bottom: 1px;
        }
        .auth-link:hover {
          color: var(--ink);
          border-bottom-color: rgba(23,32,42,0.32);
        }
        .auth-banner {
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 20px;
          font-size: 14px;
          line-height: 1.5;
        }
        .auth-banner-success {
          background: rgba(60,137,182,0.1);
          border: 1px solid rgba(60,137,182,0.25);
          color: #2a5f82;
        }
        .auth-banner-error {
          background: rgba(255,107,91,0.1);
          border: 1px solid rgba(255,107,91,0.25);
          color: #b54a3d;
        }
        .auth-error {
          font-size: 13px;
          color: #b54a3d;
          margin-top: 4px;
        }
      `}</style>
      <script async src="https://futureplans.app/sdk.js" data-site-key="fp_site_ed47c72fd18009d53acc0285"></script>
    </head>
    <body>
      <div className="auth-wrap">
        <div className="auth-card">
          <a href="/" className="auth-logo">
            <span className="auth-logo-mark">
              <span className="auth-dot auth-dot-a" />
              <span className="auth-dot auth-dot-b" />
              <span className="auth-dot auth-dot-c" />
            </span>
            <span className="auth-logo-text">AI Together</span>
          </a>
          {children}
        </div>
      </div>
    </body>
  </html>
);

export default AuthLayout;
