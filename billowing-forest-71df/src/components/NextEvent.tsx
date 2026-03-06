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
  const spotsTaken = Math.min(event.capacity, event.signupCount);
  const signupProgress = event.capacity > 0
    ? Math.min(100, Math.round((spotsTaken / event.capacity) * 100))
    : 0;
  const availabilityText = spotsLeft > 0
    ? `${spotsLeft} of ${event.capacity} spots remaining`
    : "This event is fully booked";

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
          <div className="next-event-copy">
            <p className="next-event-date">{dateStr} &middot; {timeStr}</p>
            <h3 className="next-event-title">{event.title}</h3>
            {event.description && (
              <p className="next-event-desc">{event.description}</p>
            )}
          </div>

          <div className="next-event-meta">
            {event.location_name && (
              <a
                href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="next-event-meta-card next-event-location-link"
              >
                <span className="next-event-meta-label">Location</span>
                <strong className="next-event-meta-value">{event.location_name}</strong>
                <span className="next-event-meta-link">Open in Google Maps</span>
              </a>
            )}

            <div className="next-event-meta-card">
              <span className="next-event-meta-label">Availability</span>
              <strong className="next-event-meta-value">
                {spotsLeft > 0 ? `${spotsLeft} spots left` : "Fully booked"}
              </strong>
              <span className="next-event-meta-link">{spotsTaken} people already joined</span>
            </div>
          </div>

          <div className="next-event-capacity">
            <div className="next-event-capacity-head">
              <p className="next-event-spots">{availabilityText}</p>
              <span className="next-event-capacity-ratio">
                {spotsTaken}/{event.capacity} taken
              </span>
            </div>
            <div className="next-event-capacity-track" aria-hidden="true">
              <span
                className="next-event-capacity-fill"
                style={{ width: `${signupProgress}%` }}
              ></span>
            </div>
          </div>

          <div className="next-event-map-shell">
            {event.location_name && (
              <p className="next-event-map-label">{event.location_name}</p>
            )}
            <div id="next-event-map" className="next-event-map"></div>
          </div>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossOrigin=""></script>
          <script dangerouslySetInnerHTML={{ __html: mapScript(event.latitude, event.longitude) }} />
        </div>

        <div className="next-event-form-wrap">
          <div className="next-event-form-panel">
            <p className="next-event-form-kicker">
              {isSignedUp
                ? "Reservation confirmed"
                : spotsLeft > 0
                  ? "Reserve your spot"
                  : "This session is full"}
            </p>
            <h3 className="next-event-form-title">
              {isSignedUp
                ? "You're on the list"
                : spotsLeft > 0
                  ? "Join this session"
                  : "Catch the next event"}
            </h3>
            <p className="next-event-form-text">
              {isSignedUp
                ? "Your place is already secured. We'll see you there."
                : spotsLeft > 0
                  ? "Add your details and we'll hold a place for you."
                  : "This one is already full, but more practice sessions are coming soon."}
            </p>

            {!isSignedUp && spotsLeft > 0 && (
              <div className="next-event-form-highlights" aria-label="Event highlights">
                <span className="next-event-form-highlight">Small group</span>
                <span className="next-event-form-highlight">Live demos</span>
                <span className="next-event-form-highlight">Project feedback</span>
              </div>
            )}

            {currentUser && !isSignedUp && spotsLeft > 0 && (
              <p className="next-event-form-note">
                Signed in as {currentUser.email}. Your details are locked to this account.
              </p>
            )}

            {isSignedUp ? (
              <div className="next-event-already-in">
                <div className="signup-success-icon">&#10003;</div>
                <p className="sub">You&apos;re already set. We&apos;ll see you at the event.</p>
              </div>
            ) : spotsLeft > 0 ? (
              <>
                <form
                  id="eventSignupForm"
                  className="form next-event-form"
                  data-event-id={String(event.id)}
                >
                  <label className="field">
                    <span className="label">Name</span>
                    <input
                      className={currentUser ? "is-readonly" : undefined}
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      placeholder="Your name"
                      defaultValue={currentUser?.name ?? ""}
                      readOnly={!!currentUser}
                    />
                  </label>
                  <label className="field">
                    <span className="label">Email</span>
                    <input
                      className={currentUser ? "is-readonly" : undefined}
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      defaultValue={currentUser?.email ?? ""}
                      readOnly={!!currentUser}
                    />
                  </label>
                  <div className="form-actions next-event-form-actions">
                    <button className="btn btn-primary next-event-submit" type="submit">
                      Reserve my place
                    </button>
                    <p
                      className="fine"
                      id="eventSignupStatus"
                      role="status"
                      aria-live="polite"
                    ></p>
                  </div>
                </form>

                <div id="eventSignupSuccess" className="signup-success next-event-signup-success">
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
                  This event is fully booked. Keep an eye on the next date and jump in early.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default NextEvent;
