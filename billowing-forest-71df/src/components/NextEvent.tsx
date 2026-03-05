import { type FC } from "react";

export interface EventData {
  id: number;
  title: string;
  description: string | null;
  datetime: string;
  capacity: number;
  latitude: number;
  longitude: number;
  location_name: string | null;
  signupCount: number;
}

export interface CurrentUser {
  name: string;
  email: string;
}

const mapScript = (lat: number, lng: number) => `
(function () {
  var map = L.map('next-event-map', { zoomControl: true, dragging: true, scrollWheelZoom: false }).setView([${lat}, ${lng}], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '\u00a9 OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);
  L.marker([${lat}, ${lng}]).addTo(map);
})();
`;

const NextEvent: FC<{ event: EventData; currentUser: CurrentUser | null; isSignedUp: boolean }> = ({
  event,
  currentUser,
  isSignedUp,
}) => {
  const spotsLeft = Math.max(0, event.capacity - event.signupCount);

  const date = new Date(event.datetime);
  const dateStr = date.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section id="next-event" className="section">
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <div className="section-head">
        <h2 className="h2">Next event</h2>
        <p className="sub">Join us for our upcoming AI practice session.</p>
      </div>

      <div className="next-event-card">
        <div className="next-event-info">
          <p className="next-event-date">{dateStr} &middot; {timeStr}</p>
          <h3 className="next-event-title">{event.title}</h3>
          {event.description && (
            <p className="next-event-desc">{event.description}</p>
          )}
          {event.location_name && (
            <p className="next-event-location">
              <a
                href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="next-event-location-link"
              >
                {event.location_name}
              </a>
            </p>
          )}
          <p className="next-event-spots">
            {spotsLeft > 0
              ? `${spotsLeft} of ${event.capacity} spots remaining`
              : "This event is fully booked"}
          </p>
          <div id="next-event-map" className="next-event-map"></div>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossOrigin=""></script>
          <script dangerouslySetInnerHTML={{ __html: mapScript(event.latitude, event.longitude) }} />
        </div>

        <div className="next-event-form-wrap">
          {isSignedUp ? (
            <div className="next-event-already-in">
              <div className="signup-success-icon">&#10003;</div>
              <h3 className="h3">You&apos;re already in!</h3>
              <p className="sub">Can&apos;t wait to meet you there.</p>
            </div>
          ) : spotsLeft > 0 ? (
            <>
              <form
                id="eventSignupForm"
                className="form"
                data-event-id={String(event.id)}
              >
                <label className="field">
                  <span className="label">Name</span>
                  <input
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    placeholder="Your name"
                    defaultValue={currentUser?.name ?? ""}
                    readOnly={!!currentUser}
                    style={currentUser ? { opacity: 0.7, cursor: "default" } : {}}
                  />
                </label>
                <label className="field">
                  <span className="label">Email</span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    defaultValue={currentUser?.email ?? ""}
                    readOnly={!!currentUser}
                    style={currentUser ? { opacity: 0.7, cursor: "default" } : {}}
                  />
                </label>
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit">
                    Sign me up
                  </button>
                  <p
                    className="fine"
                    id="eventSignupStatus"
                    role="status"
                    aria-live="polite"
                  ></p>
                </div>
              </form>

              <div id="eventSignupSuccess" className="signup-success">
                <div className="signup-success-icon">&#10003;</div>
                <h3 className="h3">You&apos;re in!</h3>
                <p className="sub">
                  {currentUser
                    ? "You're all set. See you at the event!"
                    : "Check your inbox to confirm your spot."}
                </p>
              </div>
            </>
          ) : (
            <div className="next-event-full">
              <p className="sub">
                This event is fully booked. Sign up below to be notified about
                future events.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default NextEvent;
