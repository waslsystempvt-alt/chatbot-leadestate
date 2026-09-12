import { Module } from "@nestjs/common";
import { MicrositesService } from "./microsites.service";
import { MicrositesController } from "./microsites.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  providers: [MicrositesService],
  controllers: [MicrositesController],
  exports: [MicrositesService],
})
export class MicrositesModule {}
