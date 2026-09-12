import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateMicrositeDto } from "./dto/create-microsite.dto";
import { UpdateMicrositeDto } from "./dto/update-microsite.dto";

@Injectable()
export class MicrositesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(brokerId: string, dto: CreateMicrositeDto, actorUserId: string) {
    try {
      const microsite = await this.prisma.microsite.create({
        data: {
          brokerId,
          slug: dto.slug,
          projectName: dto.projectName,
          agentName: dto.agentName,
          allowedDomains: dto.allowedDomains ?? [],
          themeConfig: (dto.themeConfig ?? {}) as Prisma.InputJsonValue,
        },
      });

      await this.audit.log({
        actorUserId,
        action: "microsite.create",
        targetType: "Microsite",
        targetId: microsite.id,
        meta: { slug: microsite.slug },
      });

      return microsite;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("A microsite with this slug already exists for your broker");
      }
      throw err;
    }
  }

  findAllForBroker(brokerId: string) {
    return this.prisma.microsite.findMany({
      where: { brokerId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOneForBroker(brokerId: string, id: string) {
    const microsite = await this.prisma.microsite.findFirst({ where: { id, brokerId } });
    if (!microsite) throw new NotFoundException("Microsite not found");
    return microsite;
  }

  async update(brokerId: string, id: string, dto: UpdateMicrositeDto, actorUserId: string) {
    const existing = await this.findOneForBroker(brokerId, id);

    // First time a webhook URL is set, mint a signing secret so the broker's
    // endpoint can verify the payload really came from us (see LeadsService).
    const needsSecret = !!dto.crmWebhookUrl && !existing.crmWebhookSecret;

    const microsite = await this.prisma.microsite.update({
      where: { id },
      data: {
        ...(dto.projectName !== undefined ? { projectName: dto.projectName } : {}),
        ...(dto.agentName !== undefined ? { agentName: dto.agentName } : {}),
        ...(dto.allowedDomains !== undefined ? { allowedDomains: dto.allowedDomains } : {}),
        ...(dto.themeConfig !== undefined
          ? { themeConfig: dto.themeConfig as Prisma.InputJsonValue }
          : {}),
        ...(dto.crmWebhookUrl !== undefined ? { crmWebhookUrl: dto.crmWebhookUrl } : {}),
        ...(dto.crmWebhookActive !== undefined ? { crmWebhookActive: dto.crmWebhookActive } : {}),
        ...(needsSecret ? { crmWebhookSecret: randomBytes(24).toString("hex") } : {}),
      },
    });

    await this.audit.log({
      actorUserId,
      action: "microsite.update",
      targetType: "Microsite",
      targetId: microsite.id,
      meta: {
        crmWebhookActive: microsite.crmWebhookActive,
        crmWebhookConfigured: !!microsite.crmWebhookUrl,
      },
    });

    return microsite;
  }

  recentDeliveries(brokerId: string, micrositeId: string) {
    return this.prisma.leadDeliveryLog.findMany({
      where: { brokerId, micrositeId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}
