import { Fragment, useEffect, useState } from "react";
import { TEMPLATE_VARIABLES, WEBHOOK_METHODS, WEBHOOK_PRESETS } from "@leadestate/shared-types";
import {
  type AppNotification,
  type AuthedUser,
  type CrmConnector,
  type CrmConnectorInput,
  type DeliveryLog,
  type Microsite,
  type NewLeadPayload,
  type WebhookTestResult,
  attachCrmConnector,
  buildMailto,
  createCrmConnector,
  createMicrosite,
  deleteCrmConnector,
  detachCrmConnector,
  listCrmConnectors,
  listDeliveries,
  listMicrosites,
  listNotifications,
  markNotificationRead,
  testCrmConnector,
  updateCrmConnector,
  updateMicrosite,
} from "./api";

export function BrokerAdminView({ token, user }: { token: string; user: AuthedUser }) {
  const [microsites, setMicrosites] = useState<Microsite[]>([]);
  const [connectors, setConnectors] = useState<CrmConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [ms, crm] = await Promise.all([listMicrosites(token), listCrmConnectors(token)]);
      setMicrosites(ms);
      setConnectors(crm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load microsites");
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll() {
    const [ms, crm] = await Promise.all([listMicrosites(token), listCrmConnectors(token)]);
    setMicrosites(ms);
    setConnectors(crm);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = microsites.find((m) => m.id === selectedId) ?? null;

  const query = search.trim().toLowerCase();
  const filteredMicrosites = query
    ? microsites.filter(
        (m) =>
          m.projectName.toLowerCase().includes(query) ||
          m.slug.toLowerCase().includes(query) ||
          (m.agentName ?? "").toLowerCase().includes(query),
      )
    : microsites;

  if (selected) {
    return (
      <MicrositeDetail
        token={token}
        microsite={selected}
        connectors={connectors}
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

      <CrmConnectionsPanel token={token} connectors={connectors} onChanged={refreshAll} />

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

      {!loading && microsites.length > 0 && (
        <input
          className="search-input"
          type="search"
          placeholder="Search microsites by project, slug, or agent…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {loading ? (
        <p>Loading…</p>
      ) : microsites.length === 0 ? (
        <p className="hint">No microsites yet — create one above to get an embed snippet.</p>
      ) : filteredMicrosites.length === 0 ? (
        <p className="hint">No microsites match "{search}".</p>
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
              {filteredMicrosites.map((m) => (
                <tr key={m.id}>
                  <td>{m.projectName}</td>
                  <td>
                    <code>{m.slug}</code>
                  </td>
                  <td>
                    {m.crmConnectors.length === 0 ? (
                      <span className="status status-suspended">Not connected</span>
                    ) : (
                      <span className="chip-row">
                        {m.crmConnectors.map((c) => (
                          <span
                            key={c.id}
                            className={`status ${c.isActive ? "status-active" : "status-suspended"}`}
                          >
                            {c.name}
                          </span>
                        ))}
                      </span>
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
          pattern="[a-z0-9\-]+"
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
 * A broker's CRM connectors, set up once and reusable across every one of
 * their microsites — client 1's Blox connector, client 2's HubSpot
 * connector, each fully independent, each with its own payload shape and
 * headers, and each attachable to any number of microsites at once (one
 * microsite can also fan out to several connectors simultaneously).
 */
function CrmConnectionsPanel({
  token,
  connectors,
  onChanged,
}: {
  token: string;
  connectors: CrmConnector[];
  onChanged: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function toggleActive(c: CrmConnector) {
    setError(null);
    try {
      await updateCrmConnector(token, c.id, { isActive: !c.isActive });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update connector");
    }
  }

  async function handleDelete(c: CrmConnector) {
    setError(null);
    try {
      await deleteCrmConnector(token, c.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete connector");
    }
  }

  return (
    <div className="card" style={{ maxWidth: "none", marginBottom: 20 }}>
      <div className="page-header" style={{ marginBottom: connectors.length ? 14 : 0 }}>
        <div>
          <h2 style={{ margin: 0 }}>CRM connections</h2>
          <p className="hint" style={{ margin: "4px 0 0" }}>
            Set your CRM up once here — custom payload shape, headers, method — then attach it to
            any of your microsites below. One microsite can use several connectors at once.
          </p>
        </div>
        <button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Cancel" : "+ New connection"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showCreate && (
        <CreateCrmConnectorForm
          token={token}
          onCreated={() => {
            setShowCreate(false);
            onChanged();
          }}
        />
      )}

      {connectors.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Method</th>
                <th>Webhook URL</th>
                <th>In use by</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {connectors.map((c) => (
                <Fragment key={c.id}>
                  <tr>
                    <td>{c.name}</td>
                    <td>
                      <code>{c.method}</code>
                    </td>
                    <td>
                      <code className="truncate">
                        {revealedId === c.id ? c.webhookUrl : c.webhookUrl.replace(/./g, "•").slice(0, 24)}
                      </code>{" "}
                      <button
                        className="link"
                        onClick={() => setRevealedId(revealedId === c.id ? null : c.id)}
                      >
                        {revealedId === c.id ? "hide" : "show"}
                      </button>
                    </td>
                    <td>
                      {c._count?.microsites ?? 0} microsite{(c._count?.microsites ?? 0) === 1 ? "" : "s"}
                    </td>
                    <td>
                      <span className={`status ${c.isActive ? "status-active" : "status-suspended"}`}>
                        {c.isActive ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="actions">
                      <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                        {expandedId === c.id ? "Close" : "Edit / Test"}
                      </button>
                      <button onClick={() => toggleActive(c)}>
                        {c.isActive ? "Pause" : "Activate"}
                      </button>
                      <button onClick={() => handleDelete(c)}>Delete</button>
                    </td>
                  </tr>
                  {expandedId === c.id && (
                    <tr>
                      <td colSpan={6} style={{ background: "#fafbfd" }}>
                        <EditCrmConnectorPanel
                          token={token}
                          connector={c}
                          onChanged={onChanged}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VariablePills({ onInsert }: { onInsert: (name: string) => void }) {
  return (
    <div className="pill-row">
      {TEMPLATE_VARIABLES.map((v) => (
        <button
          key={v}
          type="button"
          className="pill"
          onClick={() => onInsert(v)}
          title={`Insert {{${v}}}`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function HeadersEditor({
  headers,
  onChange,
}: {
  headers: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const entries = Object.entries(headers);

  function setEntry(index: number, key: string, value: string) {
    const next = [...entries];
    next[index] = [key, value];
    onChange(Object.fromEntries(next));
  }

  function removeEntry(index: number) {
    const next = entries.filter((_, i) => i !== index);
    onChange(Object.fromEntries(next));
  }

  return (
    <div className="headers-editor">
      {entries.map(([key, value], i) => (
        <div key={i} className="headers-row">
          <input
            placeholder="Header name (e.g. Authorization)"
            value={key}
            onChange={(e) => setEntry(i, e.target.value, value)}
          />
          <input
            placeholder="Value (e.g. Bearer xyz)"
            value={value}
            onChange={(e) => setEntry(i, key, e.target.value)}
          />
          <button type="button" className="link" onClick={() => removeEntry(i)}>
            remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...headers, "": "" })}>
        + Add header
      </button>
    </div>
  );
}

function CreateCrmConnectorForm({
  token,
  onCreated,
}: {
  token: string;
  onCreated: () => void;
}) {
  const [presetId, setPresetId] = useState(WEBHOOK_PRESETS[0].id);
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [method, setMethod] = useState<string>(WEBHOOK_PRESETS[0].method);
  const [headers, setHeaders] = useState<Record<string, string>>(WEBHOOK_PRESETS[0].headers);
  const [template, setTemplate] = useState(
    JSON.stringify(WEBHOOK_PRESETS[0].payloadTemplate, null, 2),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function applyPreset(id: string) {
    setPresetId(id);
    const preset = WEBHOOK_PRESETS.find((p) => p.id === id) ?? WEBHOOK_PRESETS[0];
    setMethod(preset.method);
    setHeaders(preset.headers);
    setTemplate(JSON.stringify(preset.payloadTemplate, null, 2));
  }

  function insertVariable(varName: string) {
    setTemplate((prev) => prev + (prev.endsWith("\n") || prev === "" ? "" : "\n") + `"${varName}": "{{${varName}}}"`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let payloadTemplate: Record<string, unknown>;
    try {
      payloadTemplate = JSON.parse(template);
    } catch {
      setError("Payload template isn't valid JSON — check for a stray comma or missing quote.");
      return;
    }

    setBusy(true);
    try {
      const cleanHeaders = Object.fromEntries(
        Object.entries(headers).filter(([k]) => k.trim() !== ""),
      );
      const dto: CrmConnectorInput = {
        name,
        webhookUrl,
        method,
        headers: cleanHeaders,
        payloadTemplate,
      };
      await createCrmConnector(token, dto);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create connection");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card connector-form" onSubmit={handleSubmit} style={{ marginBottom: 14 }}>
      <label>
        Preset
        <select value={presetId} onChange={(e) => applyPreset(e.target.value)}>
          {WEBHOOK_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid-2">
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Blox CRM"
            required
          />
        </label>
        <label>
          Method
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {WEBHOOK_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Webhook URL
        <input
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://your-crm.example.com/webhooks/leadestate"
          required
        />
      </label>

      <label>Headers</label>
      <HeadersEditor headers={headers} onChange={setHeaders} />

      <label>
        Payload template
        <p className="hint" style={{ margin: "0 0 6px" }}>
          Any JSON shape your CRM expects — click a variable to insert it as{" "}
          <code>&#123;&#123;var&#125;&#125;</code>.
        </p>
        <VariablePills onInsert={insertVariable} />
        <textarea
          className="json-editor"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          spellCheck={false}
          rows={8}
        />
      </label>

      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create connection"}
      </button>
    </form>
  );
}

function EditCrmConnectorPanel({
  token,
  connector,
  onChanged,
}: {
  token: string;
  connector: CrmConnector;
  onChanged: () => void;
}) {
  const [webhookUrl, setWebhookUrl] = useState(connector.webhookUrl);
  const [method, setMethod] = useState(connector.method);
  const [headers, setHeaders] = useState<Record<string, string>>(connector.headers ?? {});
  const [template, setTemplate] = useState(
    JSON.stringify(connector.payloadTemplate ?? WEBHOOK_PRESETS[0].payloadTemplate, null, 2),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  function insertVariable(varName: string) {
    setTemplate((prev) => prev + (prev.endsWith("\n") || prev === "" ? "" : "\n") + `"${varName}": "{{${varName}}}"`);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let payloadTemplate: Record<string, unknown>;
    try {
      payloadTemplate = JSON.parse(template);
    } catch {
      setError("Payload template isn't valid JSON.");
      return;
    }

    setBusy(true);
    try {
      const cleanHeaders = Object.fromEntries(
        Object.entries(headers).filter(([k]) => k.trim() !== ""),
      );
      await updateCrmConnector(token, connector.id, {
        webhookUrl,
        method,
        headers: cleanHeaders,
        payloadTemplate,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testCrmConnector(token, connector.id, {
        fullName: "Test Lead",
        phone: "9999999999",
        sourceAction: "Test webhook",
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        attempts: 1,
        error: err instanceof Error ? err.message : "Test failed",
        renderedPayload: null,
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <form className="connector-form" onSubmit={handleSave} style={{ padding: "14px 4px" }}>
      <div className="grid-2">
        <label>
          Webhook URL
          <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} required />
        </label>
        <label>
          Method
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {WEBHOOK_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>Headers</label>
      <HeadersEditor headers={headers} onChange={setHeaders} />

      <label>
        Payload template
        <VariablePills onInsert={insertVariable} />
        <textarea
          className="json-editor"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          spellCheck={false}
          rows={8}
        />
      </label>

      {error && <div className="error">{error}</div>}

      <div className="actions" style={{ marginTop: 10 }}>
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={handleTest} disabled={testing}>
          {testing ? "Sending test…" : "Send test lead"}
        </button>
      </div>

      {testResult && (
        <div className={testResult.ok ? "notice" : "error"} style={{ marginTop: 10 }}>
          <strong>{testResult.ok ? `Delivered (HTTP ${testResult.status})` : "Failed"}</strong>
          {testResult.error && <div>{testResult.error}</div>}
          {testResult.responseSnippet && (
            <pre className="snippet" style={{ marginTop: 6 }}>
              {testResult.responseSnippet}
            </pre>
          )}
          <p className="hint" style={{ marginTop: 6 }}>
            Payload sent:
          </p>
          <pre className="snippet">{JSON.stringify(testResult.renderedPayload, null, 2)}</pre>
        </div>
      )}
    </form>
  );
}

/**
 * Dashboard-only notifications — there's no email/SES sender anywhere in
 * this app. NEW_LEAD notifications appear here when a microsite has no CRM
 * connected (or every attached one was unreachable); "Forward by email"
 * just opens the viewer's own mail client via mailto: with the lead's
 * details prefilled. Marking one handled clears its payload server-side.
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
  connectors,
  onBack,
  onUpdated,
}: {
  token: string;
  microsite: Microsite;
  connectors: CrmConnector[];
  onBack: () => void;
  onUpdated: (m: Microsite) => void;
}) {
  const [primary, setPrimary] = useState(microsite.themeConfig?.primary ?? "");
  const [agentName, setAgentName] = useState(microsite.agentName ?? "");
  const [savingTheme, setSavingTheme] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [addConnectorId, setAddConnectorId] = useState("");
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
      onUpdated({ ...updated, crmConnectors: microsite.crmConnectors });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save theme");
    } finally {
      setSavingTheme(false);
    }
  }

  async function handleAttach() {
    if (!addConnectorId) return;
    setError(null);
    setAttaching(true);
    try {
      const updated = await attachCrmConnector(token, microsite.id, addConnectorId);
      onUpdated(updated);
      setAddConnectorId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach connector");
    } finally {
      setAttaching(false);
    }
  }

  async function handleDetach(connectorId: string) {
    setError(null);
    try {
      const updated = await detachCrmConnector(token, microsite.id, connectorId);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove connector");
    }
  }

  const attachedIds = new Set(microsite.crmConnectors.map((c) => c.id));
  const availableToAttach = connectors.filter((c) => !attachedIds.has(c.id));

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

        <div className="card">
          <h2>CRM connections</h2>
          <p className="hint">
            Attach any of your CRM connections (set up on the main page) — a lead here gets sent
            to every one attached, in parallel. LeadEstate never stores the lead's name or phone
            itself; with nothing attached, leads land on your dashboard instead.
          </p>

          {microsite.crmConnectors.length > 0 && (
            <ul className="chip-list">
              {microsite.crmConnectors.map((c) => (
                <li key={c.id} className="chip">
                  {c.name}
                  {!c.isActive && <span className="hint"> (paused)</span>}
                  <button
                    type="button"
                    className="chip-remove"
                    onClick={() => handleDetach(c.id)}
                    title="Remove"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {availableToAttach.length > 0 ? (
            <div className="inline-form" style={{ marginTop: 10 }}>
              <label style={{ flex: 1 }}>
                Attach a connection
                <select value={addConnectorId} onChange={(e) => setAddConnectorId(e.target.value)}>
                  <option value="">— choose —</option>
                  {availableToAttach.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={handleAttach} disabled={!addConnectorId || attaching}>
                {attaching ? "Attaching…" : "Attach"}
              </button>
            </div>
          ) : connectors.length === 0 ? (
            <p className="hint">
              You haven't set up a CRM connection yet — add one from the main microsites page.
            </p>
          ) : (
            <p className="hint">All of your connections are already attached here.</p>
          )}
        </div>
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
                    <td>
                      {d.method === "WEBHOOK"
                        ? `CRM: ${d.crmConnectorName ?? "unknown"}`
                        : "Dashboard notification"}
                    </td>
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
