import { IsEnum } from 'class-validator';
import { AuthPlatform } from '@prisma/client';

export class RefreshTokenRequestDto {
  @IsEnum(AuthPlatform)
  authPlatform!: AuthPlatform;
}