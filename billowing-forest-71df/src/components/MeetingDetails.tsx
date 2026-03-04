import { type FC } from "react";

const MeetingDetails: FC = () => (
  <section id="details" className="section">
    <div className="section-head">
      <h2 className="h2">Meeting details</h2>
      <p className="sub">We're keeping it simple while we grow.</p>
    </div>

    <div className="details">
      <div className="details-card">
        <dl className="dl">
          <div className="dl-row">
            <dt>Location</dt>
            <dd>
              Various community spaces across London (currently exploring free venues via local
              libraries and council halls)
            </dd>
          </div>
          <div className="dl-row">
            <dt>Frequency</dt>
            <dd>Fortnightly / every two weeks</dd>
          </div>
          <div className="dl-row">
            <dt>Group size</dt>
            <dd>Small and intimate, capped at 15 people</dd>
          </div>
          <div className="dl-row">
            <dt>Cost</dt>
            <dd>Free</dd>
          </div>
        </dl>
      </div>

      <div className="details-note">
        <h3 className="h3">A note on vibe</h3>
        <p>
          This isn't a lecture. It's more like a friendly working session: bring a goal, try a few
          things, ask for help, and share what worked.
        </p>
        <p className="fine">
          We're actively looking for accessible, free spaces — if you know a good community venue,
          tell us in the signup form.
        </p>
      </div>
    </div>
  </section>
);

export default MeetingDetails;
