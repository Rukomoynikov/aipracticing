import { type FC, type ReactNode } from "react";

interface AdminLayoutProps {
  title: string;
  children: ReactNode;
}

const AdminLayout: FC<AdminLayoutProps> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{`${title} — AI Together Admin`}</title>
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <link rel="stylesheet" href="/styles.css" />
      <style>{`
        .adm-wrap {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 40px 24px;
          background: var(--bg, #f9fafb);
        }
        .adm-inner {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
        }
        .adm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .adm-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .adm-logo-mark {
          display: flex;
          gap: 3px;
          align-items: center;
        }
        .adm-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .adm-dot-a { background: #3c89b6; }
        .adm-dot-b { background: #ff6b5b; }
        .adm-dot-c { background: #ffbf66; }
        .adm-logo-text {
          font-size: 15px;
          font-weight: 650;
          color: var(--ink);
          letter-spacing: -0.3px;
        }
        .adm-breadcrumb {
          font-size: 13px;
          color: var(--muted);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .adm-breadcrumb a {
          color: var(--muted);
          text-decoration: none;
        }
        .adm-breadcrumb a:hover { color: var(--ink); }
        .adm-card {
          background: rgba(255,255,255,0.88);
          border: 1px solid rgba(23,32,42,0.09);
          border-radius: 18px;
          padding: 32px;
          box-shadow: 0 4px 24px rgba(13,18,24,0.07);
        }
        .adm-title {
          font-size: 22px;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: -0.5px;
          margin: 0 0 4px;
        }
        .adm-sub {
          font-size: 14px;
          color: var(--muted);
          margin: 0 0 24px;
        }
        .adm-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 10px;
        }
        .adm-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          border-radius: 999px;
          border: 1px solid transparent;
          font: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
          background: linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,255,255,0.72)) padding-box,
            linear-gradient(135deg, rgba(60,137,182,0.62), rgba(255,107,91,0.55), rgba(255,191,102,0.6)) border-box;
          box-shadow: 0 4px 14px rgba(13,18,24,0.1), inset 0 1px 0 rgba(255,255,255,0.7);
          color: #10212b;
        }
        .adm-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(13,18,24,0.13), inset 0 1px 0 rgba(255,255,255,0.72);
        }
        .adm-btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }
        .adm-btn-danger {
          background: rgba(255,107,91,0.1);
          border: 1px solid rgba(255,107,91,0.3);
          color: #b54a3d;
          box-shadow: none;
        }
        .adm-btn-danger:hover {
          background: rgba(255,107,91,0.18);
          transform: none;
          box-shadow: none;
        }
        .adm-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .adm-table th {
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 0 12px 10px;
          border-bottom: 1px solid rgba(23,32,42,0.1);
        }
        .adm-table td {
          padding: 14px 12px;
          color: var(--ink);
          border-bottom: 1px solid rgba(23,32,42,0.06);
          vertical-align: middle;
        }
        .adm-table tr:last-child td { border-bottom: none; }
        .adm-table tr:hover td { background: rgba(60,137,182,0.03); }
        .adm-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }
        .adm-badge-green {
          background: rgba(34,197,94,0.12);
          color: #166534;
        }
        .adm-badge-yellow {
          background: rgba(255,191,102,0.18);
          color: #92520a;
        }
        .adm-badge-gray {
          background: rgba(23,32,42,0.07);
          color: var(--muted);
        }
        .adm-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .adm-empty {
          text-align: center;
          padding: 48px 20px;
          color: var(--muted);
          font-size: 14px;
        }
        .adm-banner {
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 20px;
          font-size: 14px;
          line-height: 1.5;
        }
        .adm-banner-success {
          background: rgba(60,137,182,0.1);
          border: 1px solid rgba(60,137,182,0.25);
          color: #2a5f82;
        }
        .adm-banner-error {
          background: rgba(255,107,91,0.1);
          border: 1px solid rgba(255,107,91,0.25);
          color: #b54a3d;
        }
      `}</style>
    </head>
    <body>
      <div className="adm-wrap">
        <div className="adm-inner">
          <div className="adm-header">
            <a href="/" className="adm-logo">
              <span className="adm-logo-mark">
                <span className="adm-dot adm-dot-a" />
                <span className="adm-dot adm-dot-b" />
                <span className="adm-dot adm-dot-c" />
              </span>
              <span className="adm-logo-text">AI Together</span>
            </a>
            <nav className="adm-breadcrumb">
              <a href="/dashboard">Dashboard</a>
              <span>/</span>
              <a href="/dashboard/admin">Admin</a>
            </nav>
          </div>
          {children}
        </div>
      </div>
    </body>
  </html>
);

export default AdminLayout;
