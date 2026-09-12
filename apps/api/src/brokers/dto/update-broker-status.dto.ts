import { IsEnum, IsISO8601, IsOptional } from "class-validator";
import { BrokerStatus } from "@prisma/client";

export class UpdateBrokerStatusDto {
  @IsEnum(BrokerStatus)
  status!: BrokerStatus;

  /** Extend/change the manual expiry date in the same call, if provided. */
  @IsOptional()
  @IsISO8601()
  subscriptionEndsAt?: string;
}
