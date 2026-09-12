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
