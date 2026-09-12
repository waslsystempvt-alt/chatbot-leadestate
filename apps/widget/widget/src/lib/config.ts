export interface ChatTheme {
  primary?: string;
  primaryDark?: string;
  primarySoft?: string;
  onPrimary?: string;
  botBubble?: string;
}

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
}

export interface ChatConfig {
  micrositeId: string;
  projectName: string;
  brokerName: string;
  agentName: string;
  theme: ChatTheme;
  scriptUrl: string;
  agentAvatar: string;
  autoOpenDelayMs: number;
  crmUrl?: string;
  formId?: string;
  pageUrl?: string;
  userAgent?: string;
  utm?: UtmParams;
}

export const DEFAULT_CHAT: ChatConfig = {
  micrositeId: "sky-estates",
  projectName: "Sky Estates",
  brokerName: "Homesfy",
  agentName: "Divya",
  theme: { primary: "#047857" },
  scriptUrl:
    "https://script.google.com/macros/s/AKfycbyUdJSAbLF5Z0eIezN3Xqqyv3-AvLV5jz0u8AylsS3qRAq1bjYPCQgapOfybgXs_le-Aw/exec",
  agentAvatar: "profile.webp",
  autoOpenDelayMs: 8000,
};

function pickDefined<T extends Record<string, unknown>>(obj: T | null | undefined): Partial<T> {
  if (!obj || typeof obj !== "object") return {};
  return Object.keys(obj).reduce((acc, key) => {
    const val = obj[key as keyof T];
    if (val !== undefined && val !== null && val !== "") {
      (acc as Record<string, unknown>)[key] = val;
    }
    return acc;
  }, {} as Partial<T>);
}

export function normalizePrimaryHex(val: string | null | undefined): string | null {
  if (!val) return null;
  let s = String(val).trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    s = s.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return "#" + s.toLowerCase();
}

export function readQueryChatConfig(): Partial<ChatConfig> {
  try {
    const p = new URLSearchParams(window.location.search);
    const out: Partial<ChatConfig> = {};
    const ms = p.get("micrositeId") || p.get("ms");
    if (ms) out.micrositeId = ms.trim();
    const project = p.get("projectName") || p.get("project");
    if (project) out.projectName = decodeURIComponent(project);
    const broker = p.get("brokerName") || p.get("broker");
    if (broker) out.brokerName = decodeURIComponent(broker);
    const agent = p.get("agentName") || p.get("agent");
    if (agent) out.agentName = decodeURIComponent(agent);
    const primary = p.get("primary") || p.get("color");
    const ph = normalizePrimaryHex(primary);
    if (ph) out.theme = { primary: ph };
    const script = p.get("scriptUrl") || p.get("script");
    if (script) out.scriptUrl = decodeURIComponent(script);
    const avatar = p.get("avatar") || p.get("agentAvatar");
    if (avatar) out.agentAvatar = decodeURIComponent(avatar);
    const autoOpen = p.get("autoOpen") || p.get("autoOpenDelayMs");
    if (autoOpen !== null) {
      const n = parseInt(autoOpen, 10);
      if (!Number.isNaN(n) && n >= 0) out.autoOpenDelayMs = n;
    }
    const crmUrl = p.get("crmUrl") || p.get("crm");
    if (crmUrl) out.crmUrl = decodeURIComponent(crmUrl);
    const formId = p.get("formId");
    if (formId) out.formId = decodeURIComponent(formId);
    const pageUrl = p.get("pageUrl");
    if (pageUrl) out.pageUrl = decodeURIComponent(pageUrl);
    const ua = p.get("ua");
    if (ua) out.userAgent = decodeURIComponent(ua);
    const utm: UtmParams = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach(
      (k) => {
        const v = p.get(k);
        if (v) (utm as Record<string, string>)[k] = v;
      }
    );
    if (Object.keys(utm).length) out.utm = utm;
    return pickDefined(out);
  } catch {
    return {};
  }
}

export function mergeChatConfig(overrides?: Partial<ChatConfig>): ChatConfig {
  const win =
    typeof window !== "undefined" &&
    (window as Window & { LEADESTATE_CHAT_CONFIG?: Partial<ChatConfig> }).LEADESTATE_CHAT_CONFIG &&
    typeof (window as Window & { LEADESTATE_CHAT_CONFIG?: Partial<ChatConfig> }).LEADESTATE_CHAT_CONFIG ===
      "object"
      ? (window as Window & { LEADESTATE_CHAT_CONFIG?: Partial<ChatConfig> }).LEADESTATE_CHAT_CONFIG!
      : {};
  const q = readQueryChatConfig();
  const flat = { ...DEFAULT_CHAT, ...pickDefined(q), ...pickDefined(win), ...pickDefined(overrides) };
  flat.theme = {
    ...(DEFAULT_CHAT.theme || {}),
    ...(q.theme || {}),
    ...(typeof win.theme === "object" && win.theme ? win.theme : {}),
    ...(overrides?.theme || {}),
  };
  return flat as ChatConfig;
}

export function isTestMode(): boolean {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get("test") === "1" || p.get("leadestate_test") === "1";
  } catch {
    return false;
  }
}

export function buildBotCopy(agentName: string, brokerLabel: string) {
  return {
    intro: `Hey there! ${agentName} from ${brokerLabel} here 👋`,
    help: "What can I help you with today?",
    actionAck: "Got it — pulling that up for you right now!",
    askConfig: "Which size suits you best?",
    afterConfigAck: "Great choice… we do have matching options open right now.",
    askNameFirst: "Please enter your name & number",
    invalidName: "Please enter a valid name (at least 2 characters).",
    invalidPhoneIndian:
      "Invalid phone number. For Indian numbers, enter a valid 10-digit number starting with 6-9.",
    submitSuccessThanks: "Thank you",
    submitSuccessDone: "Done! Our RM will call you shortly.",
    submitFailure:
      "Saved on our side, but the Sheet didn't sync. Please check the script URL and deployment access.",
  };
}
