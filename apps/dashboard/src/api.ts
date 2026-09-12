const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export type Role = "SUPER_ADMIN" | "BROKER_ADMIN" | "BROKER_AGENT";

export interface AuthedUser {
  id: string;
  email: string;
  role: Role;
  brokerId: string | null;
}

export interface Broker {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED" | "EXPIRED";
  subscriptionEndsAt: string | null;
  plan: string | null;
  createdAt: string;
  adminEmail: string | null;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** App.tsx registers this once on mount so a stale/expired token anywhere
 * (not just on login) drops the user back to the sign-in screen instead of
 * leaving a half-broken "logged in" page with failed requests. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Only a previously-authenticated request going 401 means the session
    // itself is dead (expired/invalid token) — a 401 on the login call
    // itself is just "wrong password" and shouldn't log anyone out.
    if (res.status === 401 && token) {
      onUnauthorized?.();
    }
    throw new ApiError(body.message ?? `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

export function login(email: string, password: string) {
  return request<{ accessToken: string; user: AuthedUser }>("/auth/login", null, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function listBrokers(token: string) {
  return request<Broker[]>("/brokers", token);
}

export function createBroker(
  token: string,
  dto: { name: string; slug: string; adminEmail: string; subscriptionEndsAt?: string },
) {
  return request<{ broker: Broker; adminTempPassword?: string }>("/brokers", token, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function updateBrokerStatus(
  token: string,
  id: string,
  dto: { status: Broker["status"]; subscriptionEndsAt?: string },
) {
  return request<Broker>(`/brokers/${id}/status`, token, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

export interface ThemeConfig {
  primary?: string;
  avatar?: string;
  agentName?: string;
}

export interface CrmConnectorRef {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Microsite {
  id: string;
  slug: string;
  projectName: string;
  agentName: string | null;
  allowedDomains: string[];
  themeConfig: ThemeConfig;
  status: "ACTIVE" | "PAUSED";
  crmConnectors: CrmConnectorRef[];
  createdAt: string;
}

export interface CrmConnector {
  id: string;
  name: string;
  webhookUrl: string;
  method: string;
  headers: Record<string, string> | null;
  payloadTemplate: Record<string, unknown> | null;
  webhookSecret: string;
  isActive: boolean;
  createdAt: string;
  _count?: { microsites: number };
}

export interface WebhookTestResult {
  ok: boolean;
  attempts: number;
  status?: number;
  responseSnippet?: string;
  error?: string;
  renderedPayload: unknown;
}

export interface DeliveryLog {
  id: string;
  method: "WEBHOOK" | "DASHBOARD_NOTIFICATION";
  status: "DELIVERED" | "FAILED";
  attempts: number;
  errorMessage: string | null;
  sourceAction: string | null;
  crmConnectorName: string | null;
  createdAt: string;
}

export function listMicrosites(token: string) {
  return request<Microsite[]>("/microsites", token);
}

export function createMicrosite(
  token: string,
  dto: { slug: string; projectName: string; agentName?: string },
) {
  return request<Microsite>("/microsites", token, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function updateMicrosite(
  token: string,
  id: string,
  dto: Partial<{
    projectName: string;
    agentName: string;
    themeConfig: ThemeConfig;
  }>,
) {
  return request<Microsite>(`/microsites/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

export function attachCrmConnector(token: string, micrositeId: string, connectorId: string) {
  return request<Microsite>(`/microsites/${micrositeId}/crm-connectors/${connectorId}`, token, {
    method: "POST",
  });
}

export function detachCrmConnector(token: string, micrositeId: string, connectorId: string) {
  return request<Microsite>(`/microsites/${micrositeId}/crm-connectors/${connectorId}`, token, {
    method: "DELETE",
  });
}

export function listDeliveries(token: string, micrositeId: string) {
  return request<DeliveryLog[]>(`/microsites/${micrositeId}/deliveries`, token);
}

export function listCrmConnectors(token: string) {
  return request<CrmConnector[]>("/crm-connectors", token);
}

export interface CrmConnectorInput {
  name: string;
  webhookUrl: string;
  method?: string;
  headers?: Record<string, string>;
  payloadTemplate?: Record<string, unknown>;
  isActive?: boolean;
}

export function createCrmConnector(token: string, dto: CrmConnectorInput) {
  return request<CrmConnector>("/crm-connectors", token, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function updateCrmConnector(token: string, id: string, dto: Partial<CrmConnectorInput>) {
  return request<CrmConnector>(`/crm-connectors/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

export function deleteCrmConnector(token: string, id: string) {
  return request<{ ok: true }>(`/crm-connectors/${id}`, token, { method: "DELETE" });
}

export function testCrmConnector(
  token: string,
  id: string,
  dto: { fullName?: string; phone?: string; sourceAction?: string },
) {
  return request<WebhookTestResult>(`/crm-connectors/${id}/test`, token, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export interface NewLeadPayload {
  fullName: string;
  phone: string;
  sourceAction: string | null;
  answers: Record<string, unknown> | null;
  projectName: string;
}

export interface AppNotification {
  id: string;
  type: "EXPIRY_WARNING" | "EXPIRED" | "STATUS_CHANGE" | "NEW_LEAD";
  payload: NewLeadPayload | Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export function listNotifications(token: string) {
  return request<AppNotification[]>("/notifications", token);
}

export function markNotificationRead(token: string, id: string) {
  return request<AppNotification>(`/notifications/${id}/read`, token, { method: "PATCH" });
}

/** No email sender anywhere in this app — this just opens the viewer's own
 * mail client with a prefilled draft. Nothing is sent by our backend. */
export function buildMailto(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}
