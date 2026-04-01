import { IsEnum, IsOptional } from 'class-validator';
import { JobStatus } from '../../generated/prisma/enums';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateJobDto } from './create-job.dto';

export class UpdateJobDto extends PartialType(
  OmitType(CreateJobDto, ['datapointId'] as const),
) {
  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;
}
