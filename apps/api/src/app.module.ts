import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { BrokersModule } from "./brokers/brokers.module";
import { AuditModule } from "./audit/audit.module";
import { MicrositesModule } from "./microsites/microsites.module";
import { LeadsModule } from "./leads/leads.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { CrmConnectorsModule } from "./crm-connectors/crm-connectors.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    BrokersModule,
    MicrositesModule,
    CrmConnectorsModule,
    NotificationsModule,
    LeadsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
