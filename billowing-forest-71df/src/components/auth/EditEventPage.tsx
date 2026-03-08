import { type FC } from "react";
import AuthLayout from "./AuthLayout";

export interface EditEventValues {
  title: string;
  description: string;
  datetime: string;
  capacity: string;
  latitude: string;
  longitude: string;
  locationName: string;
}

interface EditEventPageProps {
  user: { id: number; name: string; email: string; role: string };
  eventId: number;
  mapsApiKey: string;
  error?: string;
  success?: string;
  values: EditEventValues;
}

const autocompleteInitScript = (apiKey: string) => `
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
    var img = document.getElementById('map-preview');
    img.src = 'https://maps.googleapis.com/maps/api/staticmap?center=' + latStr + ',' + lngStr
      + '&zoom=14&size=1200x560&scale=1&markers=color:red%7C' + latStr + ',' + lngStr
      + '&key=${apiKey}';
    img.style.display = 'block';
  });
}
`;

const EditEventPage: FC<EditEventPageProps> = ({ eventId, mapsApiKey, error, success, values }) => {
  const hasMapsApiKey = mapsApiKey.trim().length > 0;
  const hasCoords = !!(values.latitude && values.longitude);
  const initialMapSrc = hasCoords && hasMapsApiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${values.latitude},${values.longitude}&zoom=14&size=1200x560&scale=1&markers=color:red%7C${values.latitude},${values.longitude}&key=${mapsApiKey}`
    : "";

  return (
    <AuthLayout title="Edit Event">
      <h1 className="auth-heading">Edit Event</h1>
      <p className="auth-sub">Update the event details below.</p>

      {error && <div className="auth-banner auth-banner-error">{error}</div>}
      {success && <div className="auth-banner auth-banner-success">{success}</div>}

      <form method="POST" action={`/api/admin/events/${eventId}`}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="title">Title *</label>
          <input
            className="auth-input"
            id="title"
            name="title"
            type="text"
            required
            defaultValue={values.title}
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
            defaultValue={values.description}
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
            defaultValue={values.datetime}
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
            defaultValue={values.capacity}
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
            defaultValue={values.locationName}
          />
        </div>

        <div className="auth-field">
          <label className="auth-label">Location *</label>
          <input
            className="auth-input"
            id="address-search"
            type="text"
            placeholder={hasMapsApiKey ? "Search for an address..." : "Autocomplete requires Google Maps API key"}
            autoComplete="off"
            style={{ marginBottom: 8 }}
            disabled={!hasMapsApiKey}
          />
          {!hasMapsApiKey && (
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
              Address autocomplete is disabled because GOOGLE_MAPS_API_KEY is not configured.
            </p>
          )}
          <img
            id="map-preview"
            src={initialMapSrc || undefined}
            style={{
              display: hasCoords ? "block" : "none",
              width: "100%",
              height: 280,
              borderRadius: 12,
              border: "1px solid rgba(23,32,42,0.14)",
              objectFit: "cover",
            }}
            alt="Location preview"
          />
          <p
            id="map-hint"
            style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, marginBottom: 0 }}
          >
            {hasCoords ? `Selected: ${values.latitude}, ${values.longitude}` : "No location selected yet."}
          </p>
          <input type="hidden" name="latitude" id="ev-lat" defaultValue={values.latitude} />
          <input type="hidden" name="longitude" id="ev-lng" defaultValue={values.longitude} />
        </div>

        <button className="auth-btn" type="submit">Save Changes</button>
      </form>

      <a
        href="/dashboard/admin/events"
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
        ← Back to Events
      </a>

      {hasMapsApiKey && <script dangerouslySetInnerHTML={{ __html: autocompleteInitScript(mapsApiKey) }} />}
      {hasMapsApiKey && (
        <script
          src={`https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=places&callback=initAutocomplete`}
          async
          defer
        />
      )}
    </AuthLayout>
  );
};

export default EditEventPage;
