import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @Length(6, 6, { message: 'Code must be 6 digits' })
  code: string;

  @IsEmail()
  email: string;
}
