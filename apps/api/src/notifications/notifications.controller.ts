import { BadRequestException, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BROKER_ADMIN)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  private requireBrokerId(user: AuthUser): string {
    if (!user.brokerId) throw new BadRequestException("No broker on this account");
    return user.brokerId;
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.listForBroker(this.requireBrokerId(user));
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.notifications.markRead(this.requireBrokerId(user), id);
  }
}
