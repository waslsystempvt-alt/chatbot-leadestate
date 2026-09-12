import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateMicrositeDto } from "./dto/create-microsite.dto";
import { UpdateMicrositeDto } from "./dto/update-microsite.dto";

const CRM_CONNECTOR_SELECT = { id: true, name: true, isActive: true } as const;

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
      include: { crmConnectors: { select: CRM_CONNECTOR_SELECT } },
    });
  }

  async findOneForBroker(brokerId: string, id: string) {
    const microsite = await this.prisma.microsite.findFirst({
      where: { id, brokerId },
      include: { crmConnectors: { select: CRM_CONNECTOR_SELECT } },
    });
    if (!microsite) throw new NotFoundException("Microsite not found");
    return microsite;
  }

  async update(brokerId: string, id: string, dto: UpdateMicrositeDto, actorUserId: string) {
    await this.findOneForBroker(brokerId, id);

    const microsite = await this.prisma.microsite.update({
      where: { id },
      data: {
        ...(dto.projectName !== undefined ? { projectName: dto.projectName } : {}),
        ...(dto.agentName !== undefined ? { agentName: dto.agentName } : {}),
        ...(dto.allowedDomains !== undefined ? { allowedDomains: dto.allowedDomains } : {}),
        ...(dto.themeConfig !== undefined
          ? { themeConfig: dto.themeConfig as Prisma.InputJsonValue }
          : {}),
      },
      include: { crmConnectors: { select: CRM_CONNECTOR_SELECT } },
    });

    await this.audit.log({
      actorUserId,
      action: "microsite.update",
      targetType: "Microsite",
      targetId: microsite.id,
    });

    return microsite;
  }

  /** Attaches one of the broker's own CRM connectors to this microsite.
   * Many-to-many — a microsite can have several connectors (fan-out), and
   * a connector can already be attached to other microsites (reuse). */
  async attachConnector(brokerId: string, micrositeId: string, connectorId: string, actorUserId: string) {
    await this.findOneForBroker(brokerId, micrositeId);
    const connector = await this.prisma.crmConnector.findFirst({
      where: { id: connectorId, brokerId },
    });
    if (!connector) throw new NotFoundException("Unknown CRM connector");

    const microsite = await this.prisma.microsite.update({
      where: { id: micrositeId },
      data: { crmConnectors: { connect: { id: connectorId } } },
      include: { crmConnectors: { select: CRM_CONNECTOR_SELECT } },
    });

    await this.audit.log({
      actorUserId,
      action: "microsite.crmConnector.attach",
      targetType: "Microsite",
      targetId: micrositeId,
      meta: { connectorId },
    });

    return microsite;
  }

  async detachConnector(brokerId: string, micrositeId: string, connectorId: string, actorUserId: string) {
    await this.findOneForBroker(brokerId, micrositeId);

    const microsite = await this.prisma.microsite.update({
      where: { id: micrositeId },
      data: { crmConnectors: { disconnect: { id: connectorId } } },
      include: { crmConnectors: { select: CRM_CONNECTOR_SELECT } },
    });

    await this.audit.log({
      actorUserId,
      action: "microsite.crmConnector.detach",
      targetType: "Microsite",
      targetId: micrositeId,
      meta: { connectorId },
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
