import { type FC } from "react";

const Header: FC = () => (
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

      <a className="btn btn-primary btn-small" href="#signup">Join our next session</a>
    </div>
  </header>
);

export default Header;
