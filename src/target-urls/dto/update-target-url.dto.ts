import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { UrlStatus } from '../../generated/prisma/enums';
import { CreateTargetUrlDto } from './create-target-url.dto';

export class UpdateTargetUrlDto extends PartialType(CreateTargetUrlDto) {
  @IsEnum(UrlStatus)
  @IsOptional()
  status?: UrlStatus;
}
