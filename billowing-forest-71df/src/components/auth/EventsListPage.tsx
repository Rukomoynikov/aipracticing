import { type FC } from "react";
import AdminLayout from "./AdminLayout";

export interface EventRow {
  id: number;
  title: string;
  datetime: string;
  capacity: number;
  signupCount: number;
}

interface EventsListPageProps {
  events: EventRow[];
  success?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EventsListPage: FC<EventsListPageProps> = ({ events, success }) => (
  <AdminLayout title="Events">
    <div className="adm-card">
      <div className="adm-toolbar">
        <div>
          <h1 className="adm-title">Events</h1>
          <p className="adm-sub">{events.length} event{events.length !== 1 ? "s" : ""} total</p>
        </div>
        <a href="/dashboard/admin/events/new" className="adm-btn">
          + Create Event
        </a>
      </div>

      {success && <div className="adm-banner adm-banner-success">{success}</div>}

      {events.length === 0 ? (
        <div className="adm-empty">
          <p>No events yet.</p>
          <a href="/dashboard/admin/events/new" className="adm-btn" style={{ marginTop: 12, display: "inline-flex" }}>
            Create your first event
          </a>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Date &amp; Time</th>
                <th>Signups</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const isPast = new Date(event.datetime) < new Date();
                const isFull = event.signupCount >= event.capacity;
                return (
                  <tr key={event.id}>
                    <td style={{ fontWeight: 500 }}>{event.title}</td>
                    <td style={{ whiteSpace: "nowrap", color: "var(--muted)" }}>
                      {formatDate(event.datetime)}
                    </td>
                    <td>
                      {event.signupCount} / {event.capacity}
                    </td>
                    <td>
                      {isPast ? (
                        <span className="adm-badge adm-badge-gray">Past</span>
                      ) : isFull ? (
                        <span className="adm-badge adm-badge-yellow">Full</span>
                      ) : (
                        <span className="adm-badge adm-badge-green">Open</span>
                      )}
                    </td>
                    <td>
                      <div className="adm-actions">
                        <a
                          href={`/dashboard/admin/events/${event.id}/edit`}
                          className="adm-btn adm-btn-sm"
                        >
                          Edit
                        </a>
                        <a
                          href={`/dashboard/admin/events/${event.id}/signups`}
                          className="adm-btn adm-btn-sm"
                        >
                          Signups ({event.signupCount})
                        </a>
                        <form
                          method="POST"
                          action={`/api/admin/events/${event.id}/delete`}
                          style={{ display: "inline" }}
                          className="delete-event-form"
                        >
                          <button type="submit" className="adm-btn adm-btn-sm adm-btn-danger">
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
    <script dangerouslySetInnerHTML={{ __html: `
      document.querySelectorAll('.delete-event-form').forEach(function(form) {
        form.addEventListener('submit', function(e) {
          if (!confirm('Delete this event and all its signups? This cannot be undone.')) {
            e.preventDefault();
          }
        });
      });
    ` }} />
  </AdminLayout>
);

export default EventsListPage;
