import { Injectable, NotFoundException } from "@nestjs/common";
import {
  BrokerStatus,
  CrmConnector,
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
import { buildTemplateVariables, dispatchWebhook } from "../common/webhook/webhook-dispatch";

export interface LeadSubmitResult {
  ok: boolean;
  delivered: boolean;
  method: "webhook" | "dashboard_notification" | "skipped";
  webhooksAttempted: number;
  webhooksDelivered: number;
}

@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async submit(dto: LeadSubmission): Promise<LeadSubmitResult> {
    const microsite = await this.prisma.microsite.findUnique({
      where: { id: dto.micrositeId },
      include: { broker: true, crmConnectors: { where: { isActive: true } } },
    });
    if (!microsite) throw new NotFoundException("Unknown microsite");

    // An inactive broker/microsite silently stops capturing leads rather
    // than showing a visible error on someone's live site.
    if (microsite.broker.status !== BrokerStatus.ACTIVE || microsite.status !== MicrositeStatus.ACTIVE) {
      return { ok: true, delivered: false, method: "skipped", webhooksAttempted: 0, webhooksDelivered: 0 };
    }

    const connectors = microsite.crmConnectors;

    if (connectors.length === 0) {
      await this.notifyDashboard(microsite, dto);
      await this.logDelivery(microsite, null, LeadDeliveryMethod.DASHBOARD_NOTIFICATION, LeadDeliveryStatus.DELIVERED, 1, null, dto);
      return { ok: true, delivered: true, method: "dashboard_notification", webhooksAttempted: 0, webhooksDelivered: 0 };
    }

    const variables = buildTemplateVariables({
      micrositeId: microsite.id,
      fullName: dto.fullName,
      phone: dto.phone,
      projectName: microsite.projectName,
      brokerName: microsite.broker.name,
      agentName: microsite.agentName ?? undefined,
      configuration: typeof dto.answers?.configuration === "string" ? dto.answers.configuration : undefined,
      sourceAction: dto.sourceAction,
      utmSource: dto.utmSource,
      utmMedium: dto.utmMedium,
      utmCampaign: dto.utmCampaign,
      utmTerm: dto.utmTerm,
      utmContent: dto.utmContent,
      gclid: dto.gclid,
      fbclid: dto.fbclid,
      pageUrl: dto.pageUrl,
    });

    // Fan out to every attached CRM in parallel — one microsite can push
    // the same lead to several CRMs at once (Blox + an internal system,
    // say), each with its own payload shape, headers, and HTTP method.
    const results = await Promise.allSettled(
      connectors.map((connector) => this.deliverToConnector(microsite, connector, variables, dto)),
    );

    const webhooksDelivered = results.filter((r) => r.status === "fulfilled" && r.value).length;

    if (webhooksDelivered === 0) {
      // Every configured CRM failed (or errored) — don't drop the lead,
      // put it on the broker's dashboard so they can forward it manually.
      await this.notifyDashboard(microsite, dto);
    }

    return {
      ok: true,
      delivered: true,
      method: webhooksDelivered > 0 ? "webhook" : "dashboard_notification",
      webhooksAttempted: connectors.length,
      webhooksDelivered,
    };
  }

  private async deliverToConnector(
    microsite: Microsite,
    connector: CrmConnector,
    variables: ReturnType<typeof buildTemplateVariables>,
    dto: LeadSubmission,
  ): Promise<boolean> {
    const result = await dispatchWebhook(
      {
        webhookUrl: connector.webhookUrl,
        webhookSecret: connector.webhookSecret,
        method: connector.method,
        headers: connector.headers as Record<string, string> | null,
        payloadTemplate: connector.payloadTemplate as Record<string, unknown> | null,
      },
      variables,
    );

    await this.logDelivery(
      microsite,
      connector.name,
      LeadDeliveryMethod.WEBHOOK,
      result.ok ? LeadDeliveryStatus.DELIVERED : LeadDeliveryStatus.FAILED,
      result.attempts,
      result.ok ? null : (result.error ?? `HTTP ${result.status ?? "?"}`),
      dto,
    );

    return result.ok;
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
    crmConnectorName: string | null,
    method: LeadDeliveryMethod,
    status: LeadDeliveryStatus,
    attempts: number,
    errorMessage: string | null,
    dto: LeadSubmission,
  ) {
    return this.prisma.leadDeliveryLog.create({
      data: {
        brokerId: microsite.brokerId,
        micrositeId: microsite.id,
        crmConnectorName,
        method,
        status,
        attempts,
        errorMessage,
        sourceAction: dto.sourceAction,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
      },
    });
  }
}
