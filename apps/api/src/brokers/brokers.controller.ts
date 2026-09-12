import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { BrokersService } from "./brokers.service";
import { CreateBrokerDto } from "./dto/create-broker.dto";
import { UpdateBrokerStatusDto } from "./dto/update-broker-status.dto";

// Broker lifecycle management is super-admin only — this is the "manual
// activate/deactivate, no payment gateway" panel from the plan.
@Controller("brokers")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class BrokersController {
  constructor(private brokers: BrokersService) {}

  @Get()
  findAll() {
    return this.brokers.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.brokers.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBrokerDto, @CurrentUser() actor: AuthUser) {
    return this.brokers.create(dto, actor.id);
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateBrokerStatusDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.brokers.updateStatus(id, dto, actor.id);
  }
}
