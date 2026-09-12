import { IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUrl, MinLength } from "class-validator";
import { WEBHOOK_METHODS } from "@leadestate/shared-types";

export class UpdateCrmConnectorDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;

  @IsOptional()
  @IsIn(WEBHOOK_METHODS)
  method?: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsObject()
  payloadTemplate?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
