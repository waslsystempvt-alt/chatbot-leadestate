import { Module } from "@nestjs/common";
import { BrokersService } from "./brokers.service";
import { BrokersController } from "./brokers.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  providers: [BrokersService],
  controllers: [BrokersController],
  exports: [BrokersService],
})
export class BrokersModule {}
