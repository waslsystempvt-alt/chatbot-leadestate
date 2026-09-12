import { useCallback, useRef } from "react";
import type { ChatConfig } from "../lib/config";
import { isTestMode } from "../lib/config";
import { notifyParentLeadSubmitted, postJson } from "../lib/parentBridge";
import type { ChatAnswers } from "../lib/constants";

export function useLeadSubmit(cfg: ChatConfig, agentName: string) {
  const outcomeHandled = useRef(false);

  const submitLead = useCallback(
    async (
      answers: ChatAnswers,
      onSuccess: () => void,
      onFailure: (hint: string) => void
    ): Promise<void> => {
      outcomeHandled.current = false;
      const timestamp = new Date().toISOString();
      const { name = "", phone = "", configuration = "", intent: sourceAction = "" } = answers;
      const utm = cfg.utm || {};

      const sheetTask = (async () => {
        if (!cfg.scriptUrl || cfg.scriptUrl.includes("PASTE_YOUR")) {
          throw new Error("Missing script URL");
        }
        return postJson(
          cfg.scriptUrl,
          {
            micrositeId: cfg.micrositeId,
            projectName: cfg.projectName,
            brokerName: cfg.brokerName,
            agentName,
            name,
            phone,
            configuration,
            propertyType: configuration,
            sourceAction,
            budget: "",
            timestamp,
          },
          { contentType: "text/plain;charset=utf-8" }
        );
      })();

      const crmTask = (async () => {
        if (!cfg.crmUrl) return { skipped: true };
        if (isTestMode()) {
          console.warn("[LeadEstate] TEST MODE — skipping CRM submission.");
          return { skipped: true };
        }
        return postJson(cfg.crmUrl, {
          fullName: name,
          phone,
          utmSource: utm.utm_source || "",
          utmMedium: utm.utm_medium || "",
          utmCampaign: utm.utm_campaign || "",
          utmTerm: utm.utm_term || "",
          utmContent: utm.utm_content || "",
          gclid: utm.gclid || "",
          fbclid: utm.fbclid || "",
          formId: cfg.formId || `chatbot-${cfg.micrositeId || "default"}`,
          micrositeId: cfg.micrositeId || "",
          projectName: cfg.projectName || "",
          brokerName: cfg.brokerName || "",
          agentName,
          configuration,
          sourceAction,
          pageUrl: cfg.pageUrl || "",
          userAgent: cfg.userAgent || "",
          timestamp,
        });
      })();

      let sheetResult: PromiseSettledResult<unknown> | null = null;
      let crmResult: PromiseSettledResult<{ skipped?: boolean }> | null = null;

      const finishSuccess = () => {
        if (outcomeHandled.current) return;
        outcomeHandled.current = true;
        const sheetOk = sheetResult?.status === "fulfilled";
        if (!sheetOk) {
          console.warn("[LeadEstate] Sheet failed but CRM ok:", sheetResult && "reason" in sheetResult ? sheetResult.reason : null);
        }
        if (crmResult?.status === "rejected") {
          console.warn("[LeadEstate] CRM submission failed:", crmResult.reason);
        } else if (crmResult?.status === "fulfilled" && crmResult.value && !crmResult.value.skipped) {
          console.log("[LeadEstate] CRM submission ok.");
        }
        notifyParentLeadSubmitted({
          name,
          phone,
          micrositeId: cfg.micrositeId,
          projectName: cfg.projectName,
          configuration,
          sourceAction,
        });
        onSuccess();
      };

      const finishFailure = () => {
        if (outcomeHandled.current) return;
        outcomeHandled.current = true;
        if (crmResult?.status === "rejected") {
          console.warn("[LeadEstate] CRM submission failed:", crmResult.reason);
        }
        const hint =
          sheetResult?.status === "rejected" && sheetResult.reason instanceof Error
            ? String(sheetResult.reason.message).trim()
            : "";
        onFailure(hint);
      };

      const decideOutcome = () => {
        if (outcomeHandled.current) return;
        const sheetOk = sheetResult?.status === "fulfilled";
        const crmOk =
          crmResult?.status === "fulfilled" && crmResult.value && !crmResult.value.skipped;

        if (sheetOk) {
          finishSuccess();
          return;
        }
        if (sheetResult?.status === "rejected" && crmOk) {
          finishSuccess();
          return;
        }
        if (!sheetResult || !crmResult) return;
        finishFailure();
      };

      sheetTask.then(
        (value) => {
          sheetResult = { status: "fulfilled", value };
          decideOutcome();
        },
        (reason) => {
          sheetResult = { status: "rejected", reason };
          decideOutcome();
        }
      );
      crmTask.then(
        (value) => {
          crmResult = { status: "fulfilled", value: value as { skipped?: boolean } };
          decideOutcome();
        },
        (reason) => {
          crmResult = { status: "rejected", reason };
          decideOutcome();
        }
      );
    },
    [cfg, agentName]
  );

  return { submitLead };
}
