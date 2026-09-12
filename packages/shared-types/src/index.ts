import { z } from "zod";

// ---------------------------------------------------------------------------
// Chat flow — the step graph stored in ChatFlowVersion.steps (Prisma Json).
// Represented as a map keyed by stepId (not an array) so both the flow
// editor and the widget can do O(1) "what's the next step" lookups instead
// of scanning an array.
// ---------------------------------------------------------------------------

export const ChatStepTypeSchema = z.enum(["buttons", "text", "phone", "select"]);
export type ChatStepType = z.infer<typeof ChatStepTypeSchema>;

export const ChatStepOptionSchema = z.object({
  label: z.string().min(1),
  /** stepId to go to when this option/CTA is chosen. Omit to end the flow. */
  nextStepId: z.string().optional(),
  /** marks this option as a trackable call-to-action distinct from a plain reply */
  isCta: z.boolean().optional(),
});
export type ChatStepOption = z.infer<typeof ChatStepOptionSchema>;

export const ChatStepSchema = z.object({
  id: z.string().min(1),
  type: ChatStepTypeSchema,
  prompt: z.string().min(1),
  options: z.array(ChatStepOptionSchema).optional(),
  /** for type: "text" | "phone" — field name the captured answer is stored under */
  answerKey: z.string().optional(),
});
export type ChatStep = z.infer<typeof ChatStepSchema>;

/** stepId -> step. Must contain an "entry" key marking the first step shown. */
export const ChatFlowStepsSchema = z.record(z.string(), ChatStepSchema);
export type ChatFlowSteps = z.infer<typeof ChatFlowStepsSchema>;

export const ENTRY_STEP_ID = "entry";

export interface FlowValidationIssue {
  stepId: string;
  message: string;
}

/**
 * DFS reachability + integrity check run before a flow can be published:
 *  - every step reachable from ENTRY_STEP_ID is collected (visited set)
 *  - every option's nextStepId must point at a step that exists
 *  - every step other than the entry must be reachable (no orphans)
 * O(V + E) over the step graph — cheap even for large flows.
 */
export function validateChatFlow(steps: ChatFlowSteps): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];

  if (!steps[ENTRY_STEP_ID]) {
    return [{ stepId: ENTRY_STEP_ID, message: `Flow has no "${ENTRY_STEP_ID}" step` }];
  }

  const visited = new Set<string>();
  const stack = [ENTRY_STEP_ID];

  while (stack.length > 0) {
    const stepId = stack.pop()!;
    if (visited.has(stepId)) continue;
    visited.add(stepId);

    const step = steps[stepId];
    if (!step) {
      issues.push({ stepId, message: `Referenced step "${stepId}" does not exist` });
      continue;
    }

    for (const option of step.options ?? []) {
      if (option.nextStepId) stack.push(option.nextStepId);
    }
  }

  for (const stepId of Object.keys(steps)) {
    if (!visited.has(stepId)) {
      issues.push({ stepId, message: `Step "${stepId}" is unreachable from the entry step` });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Public config the widget fetches per microsite (GET /public/microsites/:slug/config)
// ---------------------------------------------------------------------------

export const MicrositeThemeSchema = z.object({
  primary: z.string().optional(),
  avatar: z.string().url().optional(),
  agentName: z.string().optional(),
});
export type MicrositeTheme = z.infer<typeof MicrositeThemeSchema>;

export const PublicMicrositeConfigSchema = z.object({
  micrositeId: z.string(),
  projectName: z.string(),
  brokerName: z.string(),
  theme: MicrositeThemeSchema,
  steps: ChatFlowStepsSchema,
});
export type PublicMicrositeConfig = z.infer<typeof PublicMicrositeConfigSchema>;

// ---------------------------------------------------------------------------
// Lead submission — same field names the current embed.js already sends,
// so the widget/embed.js contract doesn't break when it switches from the
// Google Sheets webhook to POST /public/leads.
// ---------------------------------------------------------------------------

export const LeadSubmissionSchema = z.object({
  micrositeId: z.string(),
  fullName: z.string().min(1),
  phone: z.string().min(6),
  answers: z.record(z.string(), z.unknown()).optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
  gclid: z.string().optional(),
  fbclid: z.string().optional(),
  pageUrl: z.string().optional(),
  sourceAction: z.string().optional(),
});
export type LeadSubmission = z.infer<typeof LeadSubmissionSchema>;

// ---------------------------------------------------------------------------
// CRM webhook templating — a connector's payloadTemplate is arbitrary JSON
// containing "{{variable}}" placeholders. renderTemplate() interpolates it
// against a flat variable map, recursively, so a broker can shape the exact
// JSON their CRM expects (Blox, HubSpot, a Zapier catch hook, anything)
// instead of being locked into one fixed lead shape.
// ---------------------------------------------------------------------------

export const WEBHOOK_METHODS = ["POST", "PUT", "PATCH"] as const;
export type WebhookMethod = (typeof WEBHOOK_METHODS)[number];

/** Every variable a payload template (or header value) can reference. */
export const TEMPLATE_VARIABLES = [
  "micrositeId",
  "fullName",
  "phone",
  "projectName",
  "brokerName",
  "agentName",
  "configuration",
  "sourceAction",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmTerm",
  "utmContent",
  "gclid",
  "fbclid",
  "pageUrl",
  "timestamp",
] as const;
export type TemplateVariableName = (typeof TEMPLATE_VARIABLES)[number];

export type TemplateVariables = Partial<Record<TemplateVariableName, string>>;

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function interpolateString(input: string, variables: TemplateVariables): string {
  return input.replace(PLACEHOLDER_RE, (_match, name: string) => variables[name as TemplateVariableName] ?? "");
}

/**
 * Recursively walks a JSON value, replacing "{{var}}" placeholders inside
 * every string it finds (object keys, array entries, nested objects — the
 * whole tree), and returns a plain JSON value with the same shape as the
 * template. A string that is *exactly* one placeholder (e.g. "{{phone}}")
 * is a special case: it resolves to the raw variable value rather than a
 * stringified substitution, so numeric-looking values stay unquoted-clean
 * and missing variables become "" rather than the literal text "{{x}}".
 */
export function renderTemplate(template: unknown, variables: TemplateVariables): unknown {
  if (typeof template === "string") {
    const wholeMatch = template.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/);
    if (wholeMatch) return variables[wholeMatch[1] as TemplateVariableName] ?? "";
    return interpolateString(template, variables);
  }
  if (Array.isArray(template)) {
    return template.map((item) => renderTemplate(item, variables));
  }
  if (template && typeof template === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(template as Record<string, unknown>)) {
      out[interpolateString(key, variables)] = renderTemplate(value, variables);
    }
    return out;
  }
  return template;
}

export interface WebhookPreset {
  id: string;
  label: string;
  method: WebhookMethod;
  headers: Record<string, string>;
  payloadTemplate: Record<string, unknown>;
}

/**
 * Built-in starting points for the dashboard's "new connection" form.
 * "leadestate-standard" reproduces today's fixed lead shape (what every
 * connector sent before custom templates existed) so it stays the default.
 * "blox" mirrors the real Blox Marketing Leads API payload we found wired
 * into an actual client site (apps/widget's Lotus test) — first_name,
 * project, project_name, comment, contact, source, request_url, etc.
 * We deliberately don't ship presets for CRMs we haven't verified a real
 * payload shape for (Salesforce/LeadSquared/Zoho) — better to leave the
 * Custom template empty than guess a wrong schema.
 */
export const WEBHOOK_PRESETS: WebhookPreset[] = [
  {
    id: "leadestate-standard",
    label: "LeadEstate standard (default)",
    method: "POST",
    headers: {},
    payloadTemplate: {
      micrositeId: "{{micrositeId}}",
      fullName: "{{fullName}}",
      phone: "{{phone}}",
      projectName: "{{projectName}}",
      brokerName: "{{brokerName}}",
      agentName: "{{agentName}}",
      configuration: "{{configuration}}",
      sourceAction: "{{sourceAction}}",
      utmSource: "{{utmSource}}",
      utmMedium: "{{utmMedium}}",
      utmCampaign: "{{utmCampaign}}",
      utmTerm: "{{utmTerm}}",
      utmContent: "{{utmContent}}",
      gclid: "{{gclid}}",
      fbclid: "{{fbclid}}",
      pageUrl: "{{pageUrl}}",
      timestamp: "{{timestamp}}",
    },
  },
  {
    id: "blox",
    label: "Blox Marketing Leads API",
    method: "POST",
    headers: { Authorization: "Bearer YOUR_BLOX_TOKEN" },
    payloadTemplate: {
      first_name: "{{fullName}}",
      contact: "{{phone}}",
      request_url: "{{pageUrl}}",
      source: "{{utmSource}}",
      utm_campaign: "{{utmCampaign}}",
      comment: "{{sourceAction}}",
      project_name: "{{projectName}}",
    },
  },
  {
    id: "custom",
    label: "Custom schema",
    method: "POST",
    headers: {},
    payloadTemplate: { fullName: "{{fullName}}", phone: "{{phone}}" },
  },
];
