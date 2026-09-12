import { IsOptional, IsString } from "class-validator";

/** All optional — CrmConnectorsService fills in sensible mock values for
 * anything omitted, so "Test" works with zero input from the dashboard. */
export class TestCrmConnectorDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  sourceAction?: string;
}
