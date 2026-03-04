import { type FC } from "react";

const Footer: FC = () => (
  <footer className="footer">
    <div className="footer-inner">
      <div className="footer-card" id="signup">
        <div className="footer-copy">
          <h2 className="h2">Join us</h2>
          <p className="sub">
            Get notified about the next meetup. We'll email the date + location once it's confirmed.
          </p>
          <p className="fine">No spam. If it's not your thing, one click to unsubscribe.</p>
        </div>

        <form className="form" id="signupForm" method="post" action="/api/signup">
          <label className="field">
            <span className="label">Name</span>
            <input name="name" autoComplete="name" required placeholder="Your name" />
          </label>

          <label className="field">
            <span className="label">Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </label>

          <label className="field field-wide">
            <span className="label">
              What interests you most about AI? <span className="optional">(optional)</span>
            </span>
            <textarea
              name="interest"
              rows={3}
              placeholder="e.g. productivity workflows, creative tools, prompts for writing, AI for research…"
            ></textarea>
          </label>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Notify me</button>
            <p className="fine" id="formStatus" role="status" aria-live="polite"></p>
          </div>
        </form>
      </div>

      <div className="footer-bottom">
        <p className="fine">
          © {new Date().getFullYear()} AI Together. Made for a small London community.
        </p>
        <a className="fine link" href="#top">Back to top</a>
      </div>
    </div>
  </footer>
);

export default Footer;
