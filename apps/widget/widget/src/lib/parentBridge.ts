export interface LeadSubmittedInfo {
  micrositeId?: string;
  projectName?: string;
  phone?: string;
  name?: string;
  configuration?: string;
  sourceAction?: string;
}

export function notifyParentLeadSubmitted(info: LeadSubmittedInfo): void {
  try {
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage(
      {
        type: "leadestate:lead",
        ok: true,
        micrositeId: info.micrositeId || "",
        projectName: info.projectName || "",
        phone: info.phone || "",
        name: info.name || "",
        configuration: info.configuration || "",
        sourceAction: info.sourceAction || "",
      },
      "*"
    );
  } catch {
    /* never block success UI */
  }
}

export async function postJson(
  url: string,
  body: Record<string, unknown>,
  { contentType = "application/json" }: { contentType?: string } = {}
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: JSON.stringify(body),
    redirect: "follow",
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON ok */
  }
  if (!response.ok || data.ok === false || data.success === false) {
    const msg =
      (data && (data.error as string) || (data.message as string)) ||
      `Request failed (${response.status})`;
    throw new Error(msg);
  }
  return data;
}
