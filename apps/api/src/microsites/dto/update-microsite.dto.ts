import { IsArray, IsOptional, IsString, MinLength } from "class-validator";
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
}
