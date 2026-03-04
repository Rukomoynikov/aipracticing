import { type FC } from "react";

const HowItWorks: FC = () => (
  <section id="how" className="section">
    <div className="section-head">
      <h2 className="h2">How it works</h2>
      <p className="sub">A simple routine that makes learning feel easy (and social).</p>
    </div>

    <ol className="steps">
      <li className="step">
        <span className="step-num" aria-hidden="true">1</span>
        <div className="step-body">
          <h3 className="h3">Sign up for a session</h3>
          <p>Leave your email and we'll send the next date + location once confirmed.</p>
        </div>
      </li>
      <li className="step">
        <span className="step-num" aria-hidden="true">2</span>
        <div className="step-body">
          <h3 className="h3">Show up with your laptop</h3>
          <p>We'll work through exercises together — pair up if you like, go solo if you prefer.</p>
        </div>
      </li>
      <li className="step">
        <span className="step-num" aria-hidden="true">3</span>
        <div className="step-body">
          <h3 className="h3">Learn, experiment, and connect</h3>
          <p>Try new tools, swap tips, and leave with a few wins you can repeat at home.</p>
        </div>
      </li>
    </ol>
  </section>
);

export default HowItWorks;
