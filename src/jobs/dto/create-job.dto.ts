import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsDate,
} from 'class-validator';
import { ExtractorType, OutputFormat } from '../../generated/prisma/enums';
import { Transform } from 'class-transformer';

export class CreateJobDto {
  @IsUUID()
  @IsNotEmpty()
  datapointId!: string;

  // @IsString()
  // //@IsNotEmpty()
  // definition?: string;

  @IsString()
  @IsOptional()
  cron?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  scheduleStart?: Date;

  @Transform(({ value }) => value?.toUpperCase())
  @IsEnum(ExtractorType)
  @IsOptional()
  extractorType?: ExtractorType;

  @Transform(({ value }) => value?.toUpperCase())
  @IsEnum(OutputFormat)
  @IsOptional()
  outputFormat?: OutputFormat;

  @IsBoolean()
  @IsOptional()
  notifyOnFinish?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyOnDiff?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyOnFail?: boolean;
}
