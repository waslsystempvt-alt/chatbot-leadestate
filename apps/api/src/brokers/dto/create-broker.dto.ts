import { IsEmail, IsISO8601, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateBrokerDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: "slug must be lowercase letters, numbers, and hyphens" })
  slug!: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsISO8601()
  subscriptionEndsAt?: string;

  @IsEmail()
  adminEmail!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  adminPassword?: string;
}
