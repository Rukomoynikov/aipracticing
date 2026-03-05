import { type FC } from "react";
import AuthLayout from "./AuthLayout";

interface CreateEventPageProps {
  user: { id: number; name: string; email: string; role: string };
  error?: string;
  values?: {
    title?: string;
    description?: string;
    datetime?: string;
    capacity?: string;
    latitude?: string;
    longitude?: string;
  };
}

const mapInitScript = `
(function () {
  var latInput = document.getElementById('ev-lat');
  var lngInput = document.getElementById('ev-lng');
  var hint = document.getElementById('map-hint');
  var latVal = latInput.value;
  var lngVal = lngInput.value;
  var hasPin = latVal !== '' && lngVal !== '';
  var defaultLat = hasPin ? parseFloat(latVal) : 20;
  var defaultLng = hasPin ? parseFloat(lngVal) : 0;
  var defaultZoom = hasPin ? 12 : 2;

  var map = L.map('event-map').setView([defaultLat, defaultLng], defaultZoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '\u00a9 OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  var marker = null;
  if (hasPin) {
    marker = L.marker([parseFloat(latVal), parseFloat(lngVal)]).addTo(map);
    hint.textContent = 'Selected: ' + latVal + ', ' + lngVal;
  }

  map.on('click', function (e) {
    var lat = e.latlng.lat.toFixed(6);
    var lng = e.latlng.lng.toFixed(6);
    latInput.value = lat;
    lngInput.value = lng;
    hint.textContent = 'Selected: ' + lat + ', ' + lng;
    if (marker) {
      marker.setLatLng(e.latlng);
    } else {
      marker = L.marker(e.latlng).addTo(map);
    }
  });
})();
`;

const CreateEventPage: FC<CreateEventPageProps> = ({ error, values }) => (
  <AuthLayout title="Create Event">
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      crossOrigin=""
    />

    <h1 className="auth-heading">Create Event</h1>
    <p className="auth-sub">Fill in the details and pin the location on the map.</p>

    {error && <div className="auth-banner auth-banner-error">{error}</div>}

    <form method="POST" action="/api/admin/events">
      <div className="auth-field">
        <label className="auth-label" htmlFor="title">Title *</label>
        <input
          className="auth-input"
          id="title"
          name="title"
          type="text"
          required
          defaultValue={values?.title ?? ""}
        />
      </div>

      <div className="auth-field">
        <label className="auth-label" htmlFor="description">Description</label>
        <textarea
          className="auth-input"
          id="description"
          name="description"
          rows={3}
          style={{ resize: "vertical" }}
          defaultValue={values?.description ?? ""}
        />
      </div>

      <div className="auth-field">
        <label className="auth-label" htmlFor="datetime">Date &amp; Time *</label>
        <input
          className="auth-input"
          id="datetime"
          name="datetime"
          type="datetime-local"
          required
          defaultValue={values?.datetime ?? ""}
        />
      </div>

      <div className="auth-field">
        <label className="auth-label" htmlFor="capacity">Capacity *</label>
        <input
          className="auth-input"
          id="capacity"
          name="capacity"
          type="number"
          min={1}
          required
          defaultValue={values?.capacity ?? ""}
        />
      </div>

      <div className="auth-field">
        <label className="auth-label">Location (click map to pin) *</label>
        <div
          id="event-map"
          style={{
            height: 280,
            borderRadius: 12,
            border: "1px solid rgba(23,32,42,0.14)",
            marginTop: 2,
          }}
        />
        <p
          id="map-hint"
          style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, marginBottom: 0 }}
        >
          No location selected yet.
        </p>
        <input type="hidden" name="latitude" id="ev-lat" defaultValue={values?.latitude ?? ""} />
        <input type="hidden" name="longitude" id="ev-lng" defaultValue={values?.longitude ?? ""} />
      </div>

      <button className="auth-btn" type="submit">Create Event</button>
    </form>

    <a
      href="/dashboard/admin"
      style={{
        display: "block",
        textAlign: "center",
        padding: "10px",
        fontSize: 14,
        color: "var(--muted)",
        textDecoration: "none",
        marginTop: 8,
      }}
    >
      ← Back to Admin
    </a>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossOrigin="" />
    <script dangerouslySetInnerHTML={{ __html: mapInitScript }} />
  </AuthLayout>
);

export default CreateEventPage;
