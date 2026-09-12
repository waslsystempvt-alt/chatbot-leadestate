import { useEffect, useState } from "react";
import {
  type AppNotification,
  type AuthedUser,
  type DeliveryLog,
  type Microsite,
  type NewLeadPayload,
  buildMailto,
  createMicrosite,
  listDeliveries,
  listMicrosites,
  listNotifications,
  markNotificationRead,
  updateMicrosite,
} from "./api";

export function BrokerAdminView({ token, user }: { token: string; user: AuthedUser }) {
  const [microsites, setMicrosites] = useState<Microsite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setMicrosites(await listMicrosites(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load microsites");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = microsites.find((m) => m.id === selectedId) ?? null;

  if (selected) {
    return (
      <MicrositeDetail
        token={token}
        microsite={selected}
        onBack={() => setSelectedId(null)}
        onUpdated={(updated) => {
          setMicrosites((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }}
      />
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Your microsites</h1>
          <p className="hint">
            {user.email} · broker <code>{user.brokerId}</code>
          </p>
        </div>
        <button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Cancel" : "+ New microsite"}
        </button>
      </div>

      <NotificationsPanel token={token} />

      {showCreate && (
        <CreateMicrositeForm
          token={token}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}

      {error && <div className="error">{error}</div>}

      {loading ? (
        <p>Loading…</p>
      ) : microsites.length === 0 ? (
        <p className="hint">No microsites yet — create one above to get an embed snippet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Slug</th>
                <th>CRM</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {microsites.map((m) => (
                <tr key={m.id}>
                  <td>{m.projectName}</td>
                  <td>
                    <code>{m.slug}</code>
                  </td>
                  <td>
                    {m.crmWebhookActive ? (
                      <span className="status status-active">Connected</span>
                    ) : (
                      <span className="status status-suspended">Not connected</span>
                    )}
                  </td>
                  <td>
                    <span className={`status status-${m.status.toLowerCase()}`}>{m.status}</span>
                  </td>
                  <td className="actions">
                    <button onClick={() => setSelectedId(m.id)}>Manage</button>
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

function CreateMicrositeForm({
  token,
  onCreated,
}: {
  token: string;
  onCreated: () => void;
}) {
  const [projectName, setProjectName] = useState("");
  const [slug, setSlug] = useState("");
  const [agentName, setAgentName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createMicrosite(token, { slug, projectName, agentName: agentName || undefined });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create microsite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card inline-form" onSubmit={handleSubmit}>
      <label>
        Project name
        <input value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
      </label>
      <label>
        Slug
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          pattern="[a-z0-9-]+"
          placeholder="sky-estates"
          required
        />
      </label>
      <label>
        Agent name
        <input value={agentName} onChange={(e) => setAgentName(e.target.value)} />
      </label>
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create microsite"}
      </button>
    </form>
  );
}

/**
 * Dashboard-only notifications — there's no email/SES sender anywhere in
 * this app. NEW_LEAD notifications appear here when a microsite has no CRM
 * connected (or its webhook was down); "Forward by email" just opens the
 * viewer's own mail client via mailto: with the lead's details prefilled.
 * Marking one handled clears its payload server-side — nothing lingers.
 */
function NotificationsPanel({ token }: { token: string }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [forwardTo, setForwardTo] = useState<Record<string, string>>({});

  async function refresh() {
    try {
      const all = await listNotifications(token);
      setNotifications(all.filter((n) => !n.readAt && n.type === "NEW_LEAD"));
    } catch {
      // non-critical panel; fail quietly rather than blocking the page
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleHandled(id: string) {
    await markNotificationRead(token, id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  if (notifications.length === 0) return null;

  return (
    <div className="notice notice-warning">
      <div>
        <strong>
          {notifications.length} lead{notifications.length > 1 ? "s" : ""} waiting
        </strong>{" "}
        — no CRM connected (or it was unreachable), so these landed here instead of your CRM.
      </div>
      <ul className="expiry-list">
        {notifications.map((n) => {
          const lead = n.payload as NewLeadPayload | null;
          if (!lead) return null;
          const to = forwardTo[n.id] ?? "";
          const body = [
            `New chatbot lead — ${lead.projectName}`,
            "",
            `Name: ${lead.fullName}`,
            `Phone: ${lead.phone}`,
            lead.sourceAction ? `Interested in: ${lead.sourceAction}` : "",
          ]
            .filter(Boolean)
            .join("\n");

          return (
            <li key={n.id}>
              <span>
                <strong>{lead.fullName}</strong> · {lead.phone}
                {lead.sourceAction ? ` · ${lead.sourceAction}` : ""} ({lead.projectName})
              </span>
              <span className="actions">
                <input
                  className="forward-input"
                  placeholder="forward to email…"
                  value={to}
                  onChange={(e) =>
                    setForwardTo((prev) => ({ ...prev, [n.id]: e.target.value }))
                  }
                />
                <a
                  className="link"
                  href={to ? buildMailto(to, `New chatbot lead — ${lead.projectName}`, body) : "#"}
                  onClick={(e) => {
                    if (!to) e.preventDefault();
                  }}
                >
                  Forward by email
                </a>
                <button onClick={() => handleHandled(n.id)}>Mark handled</button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MicrositeDetail({
  token,
  microsite,
  onBack,
  onUpdated,
}: {
  token: string;
  microsite: Microsite;
  onBack: () => void;
  onUpdated: (m: Microsite) => void;
}) {
  const [primary, setPrimary] = useState(microsite.themeConfig?.primary ?? "");
  const [agentName, setAgentName] = useState(microsite.agentName ?? "");
  const [crmWebhookUrl, setCrmWebhookUrl] = useState(microsite.crmWebhookUrl ?? "");
  const [crmWebhookActive, setCrmWebhookActive] = useState(microsite.crmWebhookActive);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingCrm, setSavingCrm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryLog[]>([]);

  useEffect(() => {
    listDeliveries(token, microsite.id).then(setDeliveries).catch(() => {});
  }, [token, microsite.id]);

  async function saveTheme(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavingTheme(true);
    try {
      const updated = await updateMicrosite(token, microsite.id, {
        agentName,
        themeConfig: { ...microsite.themeConfig, primary, agentName },
      });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save theme");
    } finally {
      setSavingTheme(false);
    }
  }

  async function saveCrm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavingCrm(true);
    try {
      const updated = await updateMicrosite(token, microsite.id, {
        crmWebhookUrl,
        crmWebhookActive,
      });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save CRM connection");
    } finally {
      setSavingCrm(false);
    }
  }

  const embedSnippet = `<script
  src="https://YOUR-CHATBOT-DOMAIN/embed.js"
  data-ms="${microsite.slug}"
  data-project="${microsite.projectName}"
  data-agent="${agentName || microsite.agentName || ""}"
  data-primary="${primary || "#047857"}"
  async></script>`;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="link" onClick={onBack}>
            ← All microsites
          </button>
          <h1>{microsite.projectName}</h1>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid-2">
        <form className="card" onSubmit={saveTheme}>
          <h2>Theme &amp; branding</h2>
          <label>
            Agent name
            <input value={agentName} onChange={(e) => setAgentName(e.target.value)} />
          </label>
          <label>
            Primary color
            <input
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              placeholder="#047857"
            />
          </label>
          <button type="submit" disabled={savingTheme}>
            {savingTheme ? "Saving…" : "Save theme"}
          </button>
        </form>

        <form className="card" onSubmit={saveCrm}>
          <h2>Connect your CRM</h2>
          <p className="hint">
            Paste your CRM's inbound webhook URL (or a Zapier/Make/Pabbly step in front of it).
            Every lead is POSTed there the instant it's captured — LeadEstate never stores the
            lead's name or phone number itself. If this isn't connected, leads are emailed to you
            instead so nothing is lost.
          </p>
          <label>
            Webhook URL
            <input
              value={crmWebhookUrl}
              onChange={(e) => setCrmWebhookUrl(e.target.value)}
              placeholder="https://your-crm.example.com/webhooks/leadestate"
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={crmWebhookActive}
              onChange={(e) => setCrmWebhookActive(e.target.checked)}
            />
            Active
          </label>
          {microsite.crmWebhookSecret && (
            <p className="hint">
              Signing secret (verify <code>x-leadestate-signature</code>):{" "}
              <code>{microsite.crmWebhookSecret}</code>
            </p>
          )}
          <button type="submit" disabled={savingCrm}>
            {savingCrm ? "Saving…" : "Save CRM connection"}
          </button>
        </form>
      </div>

      <div className="card" style={{ maxWidth: "none", marginTop: 20 }}>
        <h2>Embed snippet</h2>
        <p className="hint">Paste this once on the microsite, just before &lt;/body&gt;.</p>
        <pre className="snippet">{embedSnippet}</pre>
      </div>

      <div className="card" style={{ maxWidth: "none", marginTop: 20 }}>
        <h2>Recent lead deliveries</h2>
        {deliveries.length === 0 ? (
          <p className="hint">No leads captured yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Interested in</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td>{new Date(d.createdAt).toLocaleString()}</td>
                    <td>{d.method === "WEBHOOK" ? "CRM webhook" : "Email fallback"}</td>
                    <td>
                      <span
                        className={`status ${d.status === "DELIVERED" ? "status-active" : "status-expired"}`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td>{d.attempts}</td>
                    <td>{d.sourceAction ?? "—"}</td>
                    <td className="hint">{d.errorMessage ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
