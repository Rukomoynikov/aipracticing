import { type FC } from "react";
import AuthLayout from "./AuthLayout";

interface CreateEventPageProps {
  user: { id: number; name: string; email: string; role: string };
  mapsApiKey: string;
  error?: string;
  values?: {
    title?: string;
    description?: string;
    datetime?: string;
    capacity?: string;
    latitude?: string;
    longitude?: string;
    locationName?: string;
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

  window._evMap = L.map('event-map').setView([defaultLat, defaultLng], defaultZoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '\u00a9 OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(window._evMap);

  window._evMarker = null;
  if (hasPin) {
    window._evMarker = L.marker([parseFloat(latVal), parseFloat(lngVal)]).addTo(window._evMap);
    hint.textContent = 'Selected: ' + latVal + ', ' + lngVal;
  }

  window._evMap.on('click', function (e) {
    var lat = e.latlng.lat.toFixed(6);
    var lng = e.latlng.lng.toFixed(6);
    latInput.value = lat;
    lngInput.value = lng;
    hint.textContent = 'Selected: ' + lat + ', ' + lng;
    if (window._evMarker) {
      window._evMarker.setLatLng(e.latlng);
    } else {
      window._evMarker = L.marker(e.latlng).addTo(window._evMap);
    }
  });
})();
`;

const autocompleteInitScript = `
function initAutocomplete() {
  var input = document.getElementById('address-search');
  var autocomplete = new google.maps.places.Autocomplete(input, {
    types: ['geocode', 'establishment']
  });
  autocomplete.addListener('place_changed', function () {
    var place = autocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) return;
    var lat = place.geometry.location.lat();
    var lng = place.geometry.location.lng();
    var latStr = lat.toFixed(6);
    var lngStr = lng.toFixed(6);
    document.getElementById('ev-lat').value = latStr;
    document.getElementById('ev-lng').value = lngStr;
    document.getElementById('map-hint').textContent = 'Selected: ' + latStr + ', ' + lngStr;
    var nameInput = document.getElementById('ev-location-name');
    if (nameInput && !nameInput.value) {
      nameInput.value = place.name || '';
    }
    var latlng = L.latLng(lat, lng);
    if (window._evMarker) {
      window._evMarker.setLatLng(latlng);
    } else {
      window._evMarker = L.marker(latlng).addTo(window._evMap);
    }
    window._evMap.setView(latlng, 15);
  });
}
`;

const CreateEventPage: FC<CreateEventPageProps> = ({ mapsApiKey, error, values }) => (
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
        <label className="auth-label" htmlFor="ev-location-name">Venue name</label>
        <input
          className="auth-input"
          id="ev-location-name"
          name="location_name"
          type="text"
          placeholder="e.g. The Hub, Room 2A"
          defaultValue={values?.locationName ?? ""}
        />
      </div>

      <div className="auth-field">
        <label className="auth-label">Location *</label>
        <input
          className="auth-input"
          id="address-search"
          type="text"
          placeholder="Search for an address..."
          autoComplete="off"
          style={{ marginBottom: 8 }}
        />
        <div
          id="event-map"
          style={{
            height: 280,
            borderRadius: 12,
            border: "1px solid rgba(23,32,42,0.14)",
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
    <script dangerouslySetInnerHTML={{ __html: autocompleteInitScript }} />
    <script
      src={`https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=places&callback=initAutocomplete`}
      async
      defer
    />
  </AuthLayout>
);

export default CreateEventPage;
