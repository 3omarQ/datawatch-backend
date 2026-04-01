// update-datapoint.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateDatapointDto } from './create-datapoint.dto';

export class UpdateDatapointDto extends PartialType(
  OmitType(CreateDatapointDto, ['targetUrlId'] as const),
) {}
