import { IsEnum, IsJWT } from 'class-validator';
import { AuthPlatform } from '@prisma/client';

export class GetTokenDto {
  @IsJWT()
  refreshToken!: string;

  @IsEnum(AuthPlatform)
  authPlatform!: AuthPlatform;
}