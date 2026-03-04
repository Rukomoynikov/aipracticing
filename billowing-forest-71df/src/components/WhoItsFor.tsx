import { type FC } from "react";

const WhoItsFor: FC = () => (
  <section id="who" className="section section-split">
    <div className="section-head">
      <h2 className="h2">Who it's for</h2>
      <p className="sub">
        Curious professionals, freelancers, creatives, and anyone who wants to get better at using
        AI in their work or life. No technical background required. We welcome participants of any age.
      </p>
    </div>

    <div className="split">
      <div className="panel">
        <h3 className="h3">You'll fit right in if you want to…</h3>
        <ul className="list">
          <li>turn "AI curiosity" into consistent practice</li>
          <li>learn what tools are good for (and what they're not)</li>
          <li>build a small library of prompts and workflows you can reuse</li>
          <li>meet kind people who like learning together</li>
        </ul>
      </div>

      <div className="panel panel-accent" aria-label="Examples">
        <h3 className="h3">People we love having</h3>
        <div className="chips" role="list">
          <span className="chip" role="listitem">Marketers &amp; comms</span>
          <span className="chip" role="listitem">Designers &amp; creatives</span>
          <span className="chip" role="listitem">Founders &amp; operators</span>
          <span className="chip" role="listitem">Students &amp; career switchers</span>
          <span className="chip" role="listitem">Writers &amp; researchers</span>
          <span className="chip" role="listitem">Anyone feeling "new to this"</span>
        </div>
        <p className="fine">
          We keep the group small so you can ask questions, get unstuck, and leave with momentum.
        </p>
      </div>
    </div>
  </section>
);

export default WhoItsFor;
