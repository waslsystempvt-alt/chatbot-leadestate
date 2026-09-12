import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { MicrositesService } from "./microsites.service";
import { CreateMicrositeDto } from "./dto/create-microsite.dto";
import { UpdateMicrositeDto } from "./dto/update-microsite.dto";

// Broker-owned resource: every route is scoped to CurrentUser().brokerId,
// never to an id the client passes in — a BROKER_ADMIN can never read or
// edit another broker's microsite this way.
@Controller("microsites")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BROKER_ADMIN)
export class MicrositesController {
  constructor(private microsites: MicrositesService) {}

  private requireBrokerId(user: AuthUser): string {
    if (!user.brokerId) throw new BadRequestException("No broker on this account");
    return user.brokerId;
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.microsites.findAllForBroker(this.requireBrokerId(user));
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.microsites.findOneForBroker(this.requireBrokerId(user), id);
  }

  @Get(":id/deliveries")
  deliveries(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const brokerId = this.requireBrokerId(user);
    return this.microsites.recentDeliveries(brokerId, id);
  }

  @Post()
  create(@Body() dto: CreateMicrositeDto, @CurrentUser() user: AuthUser) {
    return this.microsites.create(this.requireBrokerId(user), dto, user.id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateMicrositeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.microsites.update(this.requireBrokerId(user), id, dto, user.id);
  }
}
