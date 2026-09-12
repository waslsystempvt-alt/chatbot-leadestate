import { createHmac } from "crypto";
import {
  renderTemplate,
  WEBHOOK_METHODS,
  WEBHOOK_PRESETS,
  type TemplateVariables,
  type WebhookMethod,
} from "@leadestate/shared-types";

const TIMEOUT_MS = 5000;

/** Fallback payload shape for connectors created before custom templates
 * existed (payloadTemplate === null) — keeps them working unchanged. */
export const DEFAULT_PAYLOAD_TEMPLATE = WEBHOOK_PRESETS.find(
  (p) => p.id === "leadestate-standard",
)!.payloadTemplate;

/** Builds the flat {{variable}} -> value map a payload template renders
 * against, from a captured lead plus the microsite it landed on. */
export function buildTemplateVariables(input: {
  micrositeId: string;
  fullName: string;
  phone: string;
  projectName: string;
  brokerName: string;
  agentName?: string;
  configuration?: string;
  sourceAction?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
  fbclid?: string;
  pageUrl?: string;
}): TemplateVariables {
  return {
    micrositeId: input.micrositeId,
    fullName: input.fullName,
    phone: input.phone,
    projectName: input.projectName,
    brokerName: input.brokerName,
    agentName: input.agentName ?? "",
    configuration: input.configuration ?? "",
    sourceAction: input.sourceAction ?? "",
    utmSource: input.utmSource ?? "",
    utmMedium: input.utmMedium ?? "",
    utmCampaign: input.utmCampaign ?? "",
    utmTerm: input.utmTerm ?? "",
    utmContent: input.utmContent ?? "",
    gclid: input.gclid ?? "",
    fbclid: input.fbclid ?? "",
    pageUrl: input.pageUrl ?? "",
    timestamp: new Date().toISOString(),
  };
}

export interface WebhookTarget {
  webhookUrl: string;
  webhookSecret: string;
  method: string;
  headers: Record<string, string> | null;
  payloadTemplate: Record<string, unknown> | null;
}

export interface DispatchResult {
  ok: boolean;
  attempts: number;
  status?: number;
  responseSnippet?: string;
  error?: string;
  renderedPayload: unknown;
}

function isWebhookMethod(value: string): value is WebhookMethod {
  return (WEBHOOK_METHODS as readonly string[]).includes(value);
}

/**
 * Renders `target.payloadTemplate` against `variables`, signs it with the
 * connector's own secret, and POSTs/PUTs/PATCHes it — retrying once on
 * failure by default. Shared by real lead delivery (LeadsService) and the
 * dashboard's "Test webhook" button (CrmConnectorsService), so both send
 * byte-identical requests.
 */
export async function dispatchWebhook(
  target: WebhookTarget,
  variables: TemplateVariables,
  maxAttempts = 2,
): Promise<DispatchResult> {
  const template = target.payloadTemplate ?? DEFAULT_PAYLOAD_TEMPLATE;
  const rendered = renderTemplate(template, variables);
  const body = JSON.stringify(rendered);
  const signature = createHmac("sha256", target.webhookSecret).update(body).digest("hex");

  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(target.headers ?? {}),
  };
  // Never clobber a header the broker explicitly configured under this name.
  const hasCustomSignatureHeader = Object.keys(headers).some(
    (k) => k.toLowerCase() === "x-leadestate-signature",
  );
  if (!hasCustomSignatureHeader) headers["x-leadestate-signature"] = signature;

  const method = isWebhookMethod(target.method) ? target.method : "POST";

  let lastError: string | undefined;
  let lastStatus: number | undefined;
  let lastSnippet: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(target.webhookUrl, { method, headers, body, signal: controller.signal });
      clearTimeout(timeout);
      lastStatus = res.status;
      lastSnippet = (await res.text().catch(() => "")).slice(0, 500);
      if (res.ok) {
        return { ok: true, attempts: attempt, status: res.status, responseSnippet: lastSnippet, renderedPayload: rendered };
      }
      lastError = `CRM endpoint responded ${res.status}`;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err.message : "unknown network error";
    }
  }

  return {
    ok: false,
    attempts: maxAttempts,
    status: lastStatus,
    responseSnippet: lastSnippet,
    error: lastError,
    renderedPayload: rendered,
  };
}
