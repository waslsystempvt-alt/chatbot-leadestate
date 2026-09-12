import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import * as argon2 from "argon2";
import { Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateBrokerDto } from "./dto/create-broker.dto";
import { UpdateBrokerStatusDto } from "./dto/update-broker-status.dto";

@Injectable()
export class BrokersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateBrokerDto, actorUserId: string) {
    const tempPassword = dto.adminPassword ?? randomBytes(9).toString("base64url");
    const passwordHash = await argon2.hash(tempPassword);

    try {
      const broker = await this.prisma.$transaction(async (tx) => {
        const created = await tx.broker.create({
          data: {
            name: dto.name,
            slug: dto.slug,
            plan: dto.plan,
            subscriptionEndsAt: dto.subscriptionEndsAt ? new Date(dto.subscriptionEndsAt) : null,
          },
        });

        await tx.user.create({
          data: {
            email: dto.adminEmail,
            passwordHash,
            role: UserRole.BROKER_ADMIN,
            brokerId: created.id,
          },
        });

        return created;
      });

      await this.audit.log({
        actorUserId,
        action: "broker.create",
        targetType: "Broker",
        targetId: broker.id,
        meta: { name: broker.name, slug: broker.slug },
      });

      return {
        broker,
        // Only ever returned once, at creation time — share it with the
        // broker out of band and have them change it on first login.
        adminTempPassword: dto.adminPassword ? undefined : tempPassword,
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Broker slug or admin email already in use");
      }
      throw err;
    }
  }

  async findAll() {
    const brokers = await this.prisma.broker.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        users: {
          where: { role: UserRole.BROKER_ADMIN },
          select: { email: true },
          take: 1,
        },
      },
    });
    // Flatten to a single adminEmail — the dashboard's "email broker about
    // renewal" mailto: link needs a destination address, nothing fancier.
    return brokers.map(({ users, ...broker }) => ({
      ...broker,
      adminEmail: users[0]?.email ?? null,
    }));
  }

  async findOne(id: string) {
    const broker = await this.prisma.broker.findUnique({ where: { id } });
    if (!broker) throw new NotFoundException("Broker not found");
    return broker;
  }

  async updateStatus(id: string, dto: UpdateBrokerStatusDto, actorUserId: string) {
    await this.findOne(id);

    const broker = await this.prisma.broker.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.subscriptionEndsAt !== undefined
          ? { subscriptionEndsAt: new Date(dto.subscriptionEndsAt) }
          : {}),
      },
    });

    await this.audit.log({
      actorUserId,
      action: "broker.status_change",
      targetType: "Broker",
      targetId: broker.id,
      meta: { status: broker.status, subscriptionEndsAt: broker.subscriptionEndsAt },
    });

    return broker;
  }
}
