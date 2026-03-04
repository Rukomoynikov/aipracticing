import { type FC } from "react";

const Hero: FC = () => (
  <section className="hero">
    <div className="hero-grid">
      <div className="hero-copy">
        <p className="eyebrow">Small group • Fortnightly • Free • London</p>
        <h1 className="h1">
          Learn AI Together —
          <span className="h1-soft"> A London community for hands-on AI practice</span>
        </h1>
        <p className="lead">
          Join a small, friendly group of Londoners who meet regularly to explore AI tools, share
          tips, and build skills together. No experience needed.
        </p>

        <div className="hero-actions">
          <a className="btn btn-primary" href="#signup">
            Join Our Next Session
            <span className="btn-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M7 17L17 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M9 7H17V15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </a>
          <a className="btn btn-ghost" href="#what">See what we do</a>
        </div>

        <div className="hero-badges" aria-label="Highlights">
          <div className="badge">
            <span className="badge-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M8 6V4.5C8 3.67 8.67 3 9.5 3H14.5C15.33 3 16 3.67 16 4.5V6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M7 6H17C18.1 6 19 6.9 19 8V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V8C5 6.9 5.9 6 7 6Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M8 11H16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M8 15H13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div className="badge-text">
              <div className="badge-title">Practical sessions</div>
              <div className="badge-sub">Prompts, workflows, real use-cases</div>
            </div>
          </div>

          <div className="badge">
            <span className="badge-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M8.2 13.2L10.7 15.7L16.2 10.2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="badge-text">
              <div className="badge-title">Beginner-friendly</div>
              <div className="badge-sub">No technical background required</div>
            </div>
          </div>
        </div>
      </div>

      <aside className="hero-card" aria-label="Next session">
        <div className="hero-card-inner">
          <div className="hero-card-top">
            <p className="hero-card-kicker">Next meetup</p>
            <p className="hero-card-title">Get an invite to the next session</p>
            <p className="hero-card-sub">
              We're keeping it small and cosy — capped at 15 people so everyone gets help.
            </p>
          </div>

          <ul className="facts" aria-label="Meeting facts">
            <li>
              <span className="fact-key">Frequency</span>
              <span className="fact-val">Fortnightly / every two weeks</span>
            </li>
            <li>
              <span className="fact-key">Location</span>
              <span className="fact-val">
                Community spaces across London (exploring free venues via libraries &amp; council
                halls)
              </span>
            </li>
            <li>
              <span className="fact-key">Cost</span>
              <span className="fact-val">Free</span>
            </li>
          </ul>

          <a className="btn btn-primary btn-wide" href="#signup">Join Our Next Session</a>
          <p className="fine">
            Bring your laptop. We'll supply the prompts, gentle guidance, and a friendly vibe.
          </p>
        </div>
      </aside>
    </div>
  </section>
);

export default Hero;
