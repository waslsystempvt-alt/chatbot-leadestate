import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHmac } from "crypto";
import {
  BrokerStatus,
  LeadDeliveryMethod,
  LeadDeliveryStatus,
  Microsite,
  MicrositeStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";
import type { LeadSubmission } from "@leadestate/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

const WEBHOOK_TIMEOUT_MS = 5000;
const WEBHOOK_MAX_ATTEMPTS = 2;

export interface LeadSubmitResult {
  ok: boolean;
  delivered: boolean;
  method: "webhook" | "dashboard_notification" | "skipped";
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async submit(dto: LeadSubmission): Promise<LeadSubmitResult> {
    const microsite = await this.prisma.microsite.findUnique({
      where: { id: dto.micrositeId },
      include: { broker: true },
    });
    if (!microsite) throw new NotFoundException("Unknown microsite");

    // An inactive broker/microsite silently stops capturing leads rather
    // than showing a visible error on someone's live site.
    if (microsite.broker.status !== BrokerStatus.ACTIVE || microsite.status !== MicrositeStatus.ACTIVE) {
      return { ok: true, delivered: false, method: "skipped" };
    }

    const attribution = {
      sourceAction: dto.sourceAction,
      utmSource: dto.utmSource,
      utmMedium: dto.utmMedium,
      utmCampaign: dto.utmCampaign,
    };

    if (microsite.crmWebhookActive && microsite.crmWebhookUrl) {
      const webhookResult = await this.deliverToWebhook(microsite, dto);
      if (webhookResult.ok) {
        await this.logDelivery(
          microsite,
          LeadDeliveryMethod.WEBHOOK,
          LeadDeliveryStatus.DELIVERED,
          webhookResult.attempts,
          null,
          attribution,
        );
        return { ok: true, delivered: true, method: "webhook" };
      }

      // Webhook is down/misconfigured — don't drop the lead, put it on the
      // broker's dashboard instead so they can forward it manually.
      await this.notifyDashboard(microsite, dto);
      await this.logDelivery(
        microsite,
        LeadDeliveryMethod.DASHBOARD_NOTIFICATION,
        LeadDeliveryStatus.DELIVERED,
        webhookResult.attempts,
        webhookResult.error ?? "webhook failed",
        attribution,
      );
      return { ok: true, delivered: true, method: "dashboard_notification" };
    }

    // No CRM connected yet for this microsite — the dashboard is the only destination.
    await this.notifyDashboard(microsite, dto);
    await this.logDelivery(
      microsite,
      LeadDeliveryMethod.DASHBOARD_NOTIFICATION,
      LeadDeliveryStatus.DELIVERED,
      1,
      null,
      attribution,
    );
    return { ok: true, delivered: true, method: "dashboard_notification" };
  }

  private async deliverToWebhook(
    microsite: Microsite,
    dto: LeadSubmission,
  ): Promise<{ ok: boolean; attempts: number; error?: string }> {
    const payload = JSON.stringify({ ...dto, deliveredAt: new Date().toISOString() });
    const signature = microsite.crmWebhookSecret
      ? createHmac("sha256", microsite.crmWebhookSecret).update(payload).digest("hex")
      : undefined;

    let lastError: string | undefined;
    for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
      try {
        const res = await fetch(microsite.crmWebhookUrl!, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(signature ? { "x-leadestate-signature": signature } : {}),
          },
          body: payload,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) return { ok: true, attempts: attempt };
        lastError = `CRM endpoint responded ${res.status}`;
      } catch (err) {
        clearTimeout(timeout);
        lastError = err instanceof Error ? err.message : "unknown network error";
      }
    }

    this.logger.warn(`Webhook delivery failed for microsite ${microsite.id}: ${lastError}`);
    return { ok: false, attempts: WEBHOOK_MAX_ATTEMPTS, error: lastError };
  }

  /**
   * No email sender anywhere in this system (no SES/3rd-party dependency).
   * The lead's details go into a dashboard Notification the broker can see
   * and, if they want, forward via their own mail client (mailto:) — see
   * NotificationsService.markRead, which drops the payload once handled.
   */
  private notifyDashboard(microsite: Microsite, dto: LeadSubmission) {
    return this.notifications.create({
      brokerId: microsite.brokerId,
      micrositeId: microsite.id,
      type: NotificationType.NEW_LEAD,
      payload: {
        fullName: dto.fullName,
        phone: dto.phone,
        sourceAction: dto.sourceAction ?? null,
        answers: dto.answers ?? null,
        projectName: microsite.projectName,
      } as Prisma.InputJsonValue,
    });
  }

  private logDelivery(
    microsite: Microsite,
    method: LeadDeliveryMethod,
    status: LeadDeliveryStatus,
    attempts: number,
    errorMessage: string | null,
    attribution: {
      sourceAction?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
    },
  ) {
    return this.prisma.leadDeliveryLog.create({
      data: {
        brokerId: microsite.brokerId,
        micrositeId: microsite.id,
        method,
        status,
        attempts,
        errorMessage,
        sourceAction: attribution.sourceAction,
        utmSource: attribution.utmSource,
        utmMedium: attribution.utmMedium,
        utmCampaign: attribution.utmCampaign,
      },
    });
  }
}
