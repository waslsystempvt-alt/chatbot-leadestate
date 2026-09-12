import { IsArray, IsOptional, IsString, IsUrl, Matches, MinLength } from "class-validator";

export class ThemeConfigDto {
  @IsOptional()
  @IsString()
  primary?: string;

  @IsOptional()
  @IsUrl()
  avatar?: string;

  @IsOptional()
  @IsString()
  agentName?: string;
}

export class CreateMicrositeDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: "slug must be lowercase letters, numbers, and hyphens" })
  slug!: string;

  @IsString()
  @MinLength(1)
  projectName!: string;

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
