
import { AuthPlatform } from '@prisma/client';

export class CreateActiveSessionDto {
  id!: string;
  userId!: string;
  activeRoleId!: string | null;
  deviceId!: string;
  platform!: AuthPlatform;

  accessTokenJti!: string;
  refreshTokenJti!: string;
  refreshTokenHash!: string;

  refreshExpiresAt!: Date;

  ipAddress?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
  country?: string | null;

  isRevoked!: boolean;
}
