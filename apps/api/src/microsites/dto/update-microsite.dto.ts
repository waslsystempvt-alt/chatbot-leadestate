import { IsArray, IsBoolean, IsOptional, IsString, IsUrl, MinLength } from "class-validator";
import { ThemeConfigDto } from "./create-microsite.dto";

export class UpdateMicrositeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  projectName?: string;

  @IsOptional()
  @IsString()
  agentName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedDomains?: string[];

  @IsOptional()
  themeConfig?: ThemeConfigDto;

  /** Paste the broker's own CRM inbound webhook (or a Zapier/Make step) here. */
  @IsOptional()
  @IsUrl({ require_tld: false })
  crmWebhookUrl?: string;

  @IsOptional()
  @IsBoolean()
  crmWebhookActive?: boolean;
}
