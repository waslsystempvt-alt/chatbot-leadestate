import { Module } from "@nestjs/common";
import { CrmConnectorsService } from "./crm-connectors.service";
import { CrmConnectorsController } from "./crm-connectors.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  providers: [CrmConnectorsService],
  controllers: [CrmConnectorsController],
  exports: [CrmConnectorsService],
})
export class CrmConnectorsModule {}
