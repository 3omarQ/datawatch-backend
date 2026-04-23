// create-datapoint.dto.ts
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsArray, IsInt, Max, Min } from 'class-validator';

export class CreateDatapointDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  path: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fieldNames?: string[];

  @IsOptional()
  @IsString()
  paginationSelector?: string;
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(50)
  maxPages?: number;

  @IsUUID()
  targetUrlId: string;
}
