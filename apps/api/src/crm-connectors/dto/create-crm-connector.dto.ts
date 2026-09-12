import { IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUrl, MinLength } from "class-validator";
import { WEBHOOK_METHODS } from "@leadestate/shared-types";

export class CreateCrmConnectorDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** require_tld: false so http://localhost:... works for local testing */
  @IsUrl({ require_tld: false })
  webhookUrl!: string;

  @IsOptional()
  @IsIn(WEBHOOK_METHODS)
  method?: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  /** Arbitrary JSON with "{{variable}}" placeholders. Omit to use the
   * default LeadEstate lead shape. */
  @IsOptional()
  @IsObject()
  payloadTemplate?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
