import { IsEmail, IsString, IsOptional } from 'class-validator';

export class OAuthDto {
  @IsString()
  provider: string;

  @IsString()
  providerAccountId: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  image?: string;
}
