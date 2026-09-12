import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { CrmConnectorsService } from "./crm-connectors.service";
import { CreateCrmConnectorDto } from "./dto/create-crm-connector.dto";
import { UpdateCrmConnectorDto } from "./dto/update-crm-connector.dto";
import { TestCrmConnectorDto } from "./dto/test-crm-connector.dto";

// A broker sets a CRM connector up once here, then attaches it to any
// number of their microsites (see MicrositesController's attach/detach).
@Controller("crm-connectors")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BROKER_ADMIN)
export class CrmConnectorsController {
  constructor(private connectors: CrmConnectorsService) {}

  private requireBrokerId(user: AuthUser): string {
    if (!user.brokerId) throw new BadRequestException("No broker on this account");
    return user.brokerId;
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.connectors.findAllForBroker(this.requireBrokerId(user));
  }

  @Post()
  create(@Body() dto: CreateCrmConnectorDto, @CurrentUser() user: AuthUser) {
    return this.connectors.create(this.requireBrokerId(user), dto, user.id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateCrmConnectorDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.connectors.update(this.requireBrokerId(user), id, dto, user.id);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.connectors.remove(this.requireBrokerId(user), id, user.id);
  }

  @Post(":id/test")
  test(
    @Param("id") id: string,
    @Body() dto: TestCrmConnectorDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.connectors.test(this.requireBrokerId(user), id, dto);
  }
}
