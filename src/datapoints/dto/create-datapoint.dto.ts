// create-datapoint.dto.ts
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateDatapointDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  path: string;

  @IsUUID()
  targetUrlId: string;
}
