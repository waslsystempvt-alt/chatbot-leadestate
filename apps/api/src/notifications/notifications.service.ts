import { Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  create(input: {
    brokerId: string;
    micrositeId?: string;
    type: NotificationType;
    payload?: Prisma.InputJsonValue;
  }) {
    return this.prisma.notification.create({
      data: {
        brokerId: input.brokerId,
        micrositeId: input.micrositeId,
        type: input.type,
        payload: input.payload,
      },
    });
  }

  /** Unread first, most recent first; last 50 read ones kept for context. */
  listForBroker(brokerId: string) {
    return this.prisma.notification.findMany({
      where: { brokerId },
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      take: 50,
    });
  }

  async markRead(brokerId: string, id: string) {
    const existing = await this.prisma.notification.findFirst({ where: { id, brokerId } });
    if (!existing) throw new NotFoundException("Notification not found");

    // Once acknowledged, drop the payload — for NEW_LEAD notifications that's
    // where a lead's name/phone briefly lived. Nothing left to retain.
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), payload: Prisma.JsonNull },
    });
  }
}
