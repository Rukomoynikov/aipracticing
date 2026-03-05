import { type FC } from "react";
import AdminLayout from "./AdminLayout";

export interface SignupRow {
  id: number;
  name: string;
  email: string;
  confirmed: number;
  created_at: string;
}

export interface EventInfo {
  id: number;
  title: string;
  datetime: string;
  capacity: number;
}

interface EventSignupsPageProps {
  event: EventInfo;
  signups: SignupRow[];
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

const EventSignupsPage: FC<EventSignupsPageProps> = ({ event, signups }) => {
  const confirmed = signups.filter((s) => s.confirmed === 1).length;
  const pending = signups.length - confirmed;

  return (
    <AdminLayout title={`Signups — ${event.title}`}>
      <div className="adm-card">
        <div className="adm-toolbar">
          <div>
            <h1 className="adm-title">{event.title}</h1>
            <p className="adm-sub">
              {formatDate(event.datetime)} &bull; {confirmed} confirmed / {pending} pending / {event.capacity} capacity
            </p>
          </div>
          <a href="/dashboard/admin/events" className="adm-btn adm-btn-sm">
            ← All Events
          </a>
        </div>

        {signups.length === 0 ? (
          <div className="adm-empty">
            <p>No signups yet for this event.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Signed up</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((signup, i) => (
                  <tr key={signup.id}>
                    <td style={{ color: "var(--muted)", fontSize: 13 }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{signup.name}</td>
                    <td style={{ color: "var(--muted)" }}>{signup.email}</td>
                    <td>
                      {signup.confirmed === 1 ? (
                        <span className="adm-badge adm-badge-green">Confirmed</span>
                      ) : (
                        <span className="adm-badge adm-badge-yellow">Pending</span>
                      )}
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 13, whiteSpace: "nowrap" }}>
                      {formatDate(signup.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default EventSignupsPage;
