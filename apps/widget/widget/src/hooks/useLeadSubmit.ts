import { useCallback } from "react";
import type { ChatConfig } from "../lib/config";
import { isTestMode } from "../lib/config";
import { notifyParentLeadSubmitted, postJson } from "../lib/parentBridge";
import type { ChatAnswers } from "../lib/constants";

export function useLeadSubmit(cfg: ChatConfig) {
  const submitLead = useCallback(
    async (
      answers: ChatAnswers,
      onSuccess: () => void,
      onFailure: (hint: string) => void
    ): Promise<void> => {
      const { name = "", phone = "", configuration = "", intent: sourceAction = "" } = answers;
      const utm = cfg.utm || {};

      if (isTestMode()) {
        console.warn("[LeadEstate] TEST MODE — skipping lead submission.");
        notifyParentLeadSubmitted({
          name,
          phone,
          micrositeId: cfg.micrositeId,
          projectName: cfg.projectName,
          configuration,
          sourceAction,
        });
        onSuccess();
        return;
      }

      try {
        await postJson(`${cfg.apiBase.replace(/\/+$/, "")}/public/leads`, {
          micrositeId: cfg.micrositeId,
          fullName: name,
          phone,
          answers: { configuration, intent: sourceAction },
          sourceAction,
          utmSource: utm.utm_source,
          utmMedium: utm.utm_medium,
          utmCampaign: utm.utm_campaign,
          utmTerm: utm.utm_term,
          utmContent: utm.utm_content,
          gclid: utm.gclid,
          fbclid: utm.fbclid,
          pageUrl: cfg.pageUrl,
        });

        notifyParentLeadSubmitted({
          name,
          phone,
          micrositeId: cfg.micrositeId,
          projectName: cfg.projectName,
          configuration,
          sourceAction,
        });
        onSuccess();
      } catch (err) {
        console.warn("[LeadEstate] Lead submission failed:", err);
        onFailure(err instanceof Error ? err.message : "");
      }
    },
    [cfg]
  );

  return { submitLead };
}
