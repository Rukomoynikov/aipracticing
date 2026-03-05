import { type FC } from "react";

const Header: FC<{ isAuthenticated?: boolean }> = ({ isAuthenticated }) => (
  <header className="top">
    <div className="top-inner">
      <a className="brand" href="#top" aria-label="AI Together home">
        <span className="brand-mark" aria-hidden="true">
          <span className="dot dot-a"></span>
          <span className="dot dot-b"></span>
          <span className="dot dot-c"></span>
        </span>
        <span className="brand-text">
          <span className="brand-name">AI Together</span>
          <span className="brand-tag">London community club</span>
        </span>
      </a>

      <nav className="nav" aria-label="Primary">
        <a href="#what">What we do</a>
        <a href="#who">Who it's for</a>
        <a href="#how">How it works</a>
        <a href="#details">Meeting details</a>
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isAuthenticated ? (
          <>
            <a className="btn btn-ghost btn-small" href="/dashboard">Dashboard</a>
            <form method="POST" action="/api/auth/logout" style={{ margin: 0 }}>
              <button type="submit" className="btn btn-primary btn-small">Sign out</button>
            </form>
          </>
        ) : (
          <>
            <a className="btn btn-ghost btn-small" href="/login">Sign in</a>
            <a className="btn btn-primary btn-small" href="/signup">Sign up</a>
          </>
        )}
      </div>
    </div>
  </header>
);

export default Header;
