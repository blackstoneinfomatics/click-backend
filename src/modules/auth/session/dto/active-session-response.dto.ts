
import { AuthPlatform } from '@prisma/client';

export class ActiveSessionResponseDto {
  id!: string;
  deviceId!: string;
  platform!: AuthPlatform;

  ipAddress!: string | null;
  userAgent!: string | null;
  appVersion!: string | null;
  country!: string | null;

  loginAt!: Date;
  lastAccessedAt!: Date | null;
  refreshExpiresAt!: Date;
}
