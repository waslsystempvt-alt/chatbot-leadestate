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

export interface Microsite {
  id: string;
  slug: string;
  projectName: string;
  agentName: string | null;
  allowedDomains: string[];
  themeConfig: ThemeConfig;
  status: "ACTIVE" | "PAUSED";
  crmWebhookUrl: string | null;
  crmWebhookSecret: string | null;
  crmWebhookActive: boolean;
  createdAt: string;
}

export interface DeliveryLog {
  id: string;
  method: "WEBHOOK" | "DASHBOARD_NOTIFICATION";
  status: "DELIVERED" | "FAILED";
  attempts: number;
  errorMessage: string | null;
  sourceAction: string | null;
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
    crmWebhookUrl: string;
    crmWebhookActive: boolean;
  }>,
) {
  return request<Microsite>(`/microsites/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

export function listDeliveries(token: string, micrositeId: string) {
  return request<DeliveryLog[]>(`/microsites/${micrositeId}/deliveries`, token);
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
