import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { dispatchWebhook, buildTemplateVariables } from "../common/webhook/webhook-dispatch";
import { CreateCrmConnectorDto } from "./dto/create-crm-connector.dto";
import { UpdateCrmConnectorDto } from "./dto/update-crm-connector.dto";
import { TestCrmConnectorDto } from "./dto/test-crm-connector.dto";

@Injectable()
export class CrmConnectorsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(brokerId: string, dto: CreateCrmConnectorDto, actorUserId: string) {
    const connector = await this.prisma.crmConnector.create({
      data: {
        brokerId,
        name: dto.name,
        webhookUrl: dto.webhookUrl,
        method: dto.method ?? "POST",
        headers: (dto.headers ?? undefined) as Prisma.InputJsonValue | undefined,
        payloadTemplate: (dto.payloadTemplate ?? undefined) as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive ?? true,
        webhookSecret: randomBytes(24).toString("hex"),
      },
    });

    await this.audit.log({
      actorUserId,
      action: "crmConnector.create",
      targetType: "CrmConnector",
      targetId: connector.id,
      meta: { name: connector.name },
    });

    return connector;
  }

  findAllForBroker(brokerId: string) {
    return this.prisma.crmConnector.findMany({
      where: { brokerId },
      orderBy: { createdAt: "desc" },
      // usage count lets the dashboard warn before deleting a connector
      // that's still wired to live microsites
      include: { _count: { select: { microsites: true } } },
    });
  }

  async findOneForBroker(brokerId: string, id: string) {
    const connector = await this.prisma.crmConnector.findFirst({ where: { id, brokerId } });
    if (!connector) throw new NotFoundException("CRM connector not found");
    return connector;
  }

  async update(brokerId: string, id: string, dto: UpdateCrmConnectorDto, actorUserId: string) {
    await this.findOneForBroker(brokerId, id);

    const connector = await this.prisma.crmConnector.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.webhookUrl !== undefined ? { webhookUrl: dto.webhookUrl } : {}),
        ...(dto.method !== undefined ? { method: dto.method } : {}),
        ...(dto.headers !== undefined ? { headers: dto.headers as Prisma.InputJsonValue } : {}),
        ...(dto.payloadTemplate !== undefined
          ? { payloadTemplate: dto.payloadTemplate as Prisma.InputJsonValue }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.log({
      actorUserId,
      action: "crmConnector.update",
      targetType: "CrmConnector",
      targetId: connector.id,
      meta: { isActive: connector.isActive },
    });

    return connector;
  }

  async remove(brokerId: string, id: string, actorUserId: string) {
    await this.findOneForBroker(brokerId, id);
    // Microsite<->CrmConnector is many-to-many — deleting the connector just
    // drops those join rows; affected microsites fall back to dashboard
    // notifications, not an error.
    await this.prisma.crmConnector.delete({ where: { id } });

    await this.audit.log({
      actorUserId,
      action: "crmConnector.delete",
      targetType: "CrmConnector",
      targetId: id,
    });

    return { ok: true };
  }

  /** Sends one real (but clearly mock) request through the exact same
   * dispatchWebhook() path a live lead uses, so "Test" in the dashboard
   * proves the template/headers/auth actually work — no LeadDeliveryLog
   * row is written, this never touches lead PII. */
  async test(brokerId: string, id: string, dto: TestCrmConnectorDto) {
    const connector = await this.findOneForBroker(brokerId, id);

    const variables = buildTemplateVariables({
      micrositeId: "test-microsite-id",
      fullName: dto.fullName ?? "Test Lead",
      phone: dto.phone ?? "9999999999",
      projectName: "Test Project",
      brokerName: "Your Brokerage",
      agentName: "Test Agent",
      configuration: "2 BHK",
      sourceAction: dto.sourceAction ?? "Test webhook",
      pageUrl: "https://example.com/test-page",
    });

    const result = await dispatchWebhook(
      {
        webhookUrl: connector.webhookUrl,
        webhookSecret: connector.webhookSecret,
        method: connector.method,
        headers: connector.headers as Record<string, string> | null,
        payloadTemplate: connector.payloadTemplate as Record<string, unknown> | null,
      },
      variables,
      1, // one attempt only — this is a manual test, not a real delivery
    );

    return result;
  }
}
