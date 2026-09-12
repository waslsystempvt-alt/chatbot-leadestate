import { useEffect, useState } from "react";
import {
  type AuthedUser,
  type Broker,
  buildMailto,
  createBroker,
  listBrokers,
  login,
  updateBrokerStatus,
} from "./api";
import { BrokerAdminView } from "./BrokerAdminView";

const EXPIRY_WARNING_DAYS = 7;
const RENEW_EXTENSION_DAYS = 30;

function daysUntil(dateIso: string): number {
  const ms = new Date(dateIso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const TOKEN_KEY = "leadestate_token";
const USER_KEY = "leadestate_user";

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthedUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthedUser) : null;
  });

  function handleLoggedIn(nextToken: string, nextUser: AuthedUser) {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">LeadEstate</div>
        {user && (
          <div className="who">
            <span className="badge">{user.role}</span>
            <span>{user.email}</span>
            <button className="link" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </header>

      <main>
        {!token || !user ? (
          <LoginView onLoggedIn={handleLoggedIn} />
        ) : user.role === "SUPER_ADMIN" ? (
          <SuperAdminView token={token} />
        ) : user.role === "BROKER_ADMIN" ? (
          <BrokerAdminView token={token} user={user} />
        ) : (
          <BrokerPlaceholderView user={user} />
        )}
      </main>
    </div>
  );
}

function LoginView({
  onLoggedIn,
}: {
  onLoggedIn: (token: string, user: AuthedUser) => void;
}) {
  const [email, setEmail] = useState("admin@leadestate.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await login(email, password);
      onLoggedIn(res.accessToken, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Sign in</h1>
        <p className="hint">
          Super admin default: <code>admin@leadestate.local</code> /{" "}
          <code>changeme123</code> (from <code>npm run prisma:seed</code>)
        </p>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function BrokerPlaceholderView({ user }: { user: AuthedUser }) {
  return (
    <div className="center">
      <div className="card">
        <h1>Welcome</h1>
        <p>
          You're signed in as <strong>{user.role}</strong> for broker{" "}
          <code>{user.brokerId}</code>.
        </p>
        <p className="hint">
          The broker dashboard (microsites, chat-flow editor, CRM) ships in Phase 2/3.
          This confirms role-based login and API access already work end to end.
        </p>
      </div>
    </div>
  );
}

function SuperAdminView({ token }: { token: string }) {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [lastTempPassword, setLastTempPassword] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setBrokers(await listBrokers(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load brokers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStatusChange(id: string, status: Broker["status"]) {
    try {
      await updateBrokerStatus(token, id, { status });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handleRenew(id: string) {
    try {
      await updateBrokerStatus(token, id, {
        status: "ACTIVE",
        subscriptionEndsAt: addDays(new Date(), RENEW_EXTENSION_DAYS).toISOString(),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to renew");
    }
  }

  const expiringSoon = brokers.filter(
    (b) =>
      b.status !== "SUSPENDED" &&
      b.subscriptionEndsAt &&
      daysUntil(b.subscriptionEndsAt) <= EXPIRY_WARNING_DAYS,
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Brokers</h1>
        <button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Cancel" : "+ New broker"}
        </button>
      </div>

      {expiringSoon.length > 0 && (
        <div className="notice notice-warning">
          <div>
            <strong>
              {expiringSoon.length} broker{expiringSoon.length > 1 ? "s" : ""} need
              {expiringSoon.length > 1 ? "" : "s"} attention
            </strong>{" "}
            — subscription expiring soon or already expired. No auto-billing runs here;
            renew manually below or reach out by email first.
          </div>
          <ul className="expiry-list">
            {expiringSoon.map((b) => {
              const days = b.subscriptionEndsAt ? daysUntil(b.subscriptionEndsAt) : null;
              return (
                <li key={b.id}>
                  <span>
                    <strong>{b.name}</strong>{" "}
                    {days !== null &&
                      (days < 0
                        ? `expired ${Math.abs(days)}d ago`
                        : days === 0
                          ? "expires today"
                          : `expires in ${days}d`)}
                  </span>
                  <span className="actions">
                    {b.adminEmail && (
                      <a
                        className="link"
                        href={buildMailto(
                          b.adminEmail,
                          `Your LeadEstate subscription — action needed`,
                          `Hi,\n\nYour LeadEstate chatbot subscription for ${b.name} ${
                            days !== null && days < 0 ? "has expired" : `expires in ${days} day(s)`
                          }. Please get in touch to renew and avoid any interruption to lead capture on your microsites.\n\nThanks!`,
                        )}
                      >
                        Email {b.name}
                      </a>
                    )}
                    <button onClick={() => handleRenew(b.id)}>
                      Renew +{RENEW_EXTENSION_DAYS}d
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {lastTempPassword && (
        <div className="notice">
          Broker admin created. Temp password (shown once):{" "}
          <code>{lastTempPassword}</code>
          <button className="link" onClick={() => setLastTempPassword(null)}>
            dismiss
          </button>
        </div>
      )}

      {showCreate && (
        <CreateBrokerForm
          token={token}
          onCreated={(pw) => {
            setLastTempPassword(pw ?? null);
            setShowCreate(false);
            refresh();
          }}
        />
      )}

      {error && <div className="error">{error}</div>}

      {loading ? (
        <p>Loading…</p>
      ) : brokers.length === 0 ? (
        <p className="hint">No brokers yet — create one above.</p>
      ) : (
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {brokers.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>
                  <code>{b.slug}</code>
                </td>
                <td>
                  <span className={`status status-${b.status.toLowerCase()}`}>{b.status}</span>
                </td>
                <td>
                  {b.subscriptionEndsAt
                    ? new Date(b.subscriptionEndsAt).toLocaleDateString()
                    : "—"}
                </td>
                <td className="actions">
                  {b.status !== "ACTIVE" && (
                    <button onClick={() => handleStatusChange(b.id, "ACTIVE")}>Activate</button>
                  )}
                  {b.status !== "SUSPENDED" && (
                    <button onClick={() => handleStatusChange(b.id, "SUSPENDED")}>Suspend</button>
                  )}
                  {b.status !== "EXPIRED" && (
                    <button onClick={() => handleStatusChange(b.id, "EXPIRED")}>
                      Mark expired
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

function CreateBrokerForm({
  token,
  onCreated,
}: {
  token: string;
  onCreated: (tempPassword?: string) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await createBroker(token, {
        name,
        slug,
        adminEmail,
        subscriptionEndsAt: subscriptionEndsAt
          ? new Date(subscriptionEndsAt).toISOString()
          : undefined,
      });
      onCreated(res.adminTempPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create broker");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card inline-form" onSubmit={handleSubmit}>
      <label>
        Broker name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Slug
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          pattern="[a-z0-9-]+"
          placeholder="homesfy"
          required
        />
      </label>
      <label>
        Admin email
        <input
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          type="email"
          required
        />
      </label>
      <label>
        Subscription ends
        <input
          value={subscriptionEndsAt}
          onChange={(e) => setSubscriptionEndsAt(e.target.value)}
          type="date"
        />
      </label>
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create broker"}
      </button>
    </form>
  );
}
