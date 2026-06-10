import { IsString, IsUrl, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateTargetUrlDto {
  @IsUrl({}, { message: 'Must be a valid URL' })
  url!: string;
}
