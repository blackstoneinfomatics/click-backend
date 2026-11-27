
import { AuthPlatform } from '@prisma/client';

export interface CachedActiveSession {
  id: string;
  userId: string;
  activeRoleId: string | null;
  deviceId: string;
  platform: AuthPlatform;

  accessTokenJti: string;
  refreshTokenJti: string;

  refreshExpiresAt: string;

  isRevoked: boolean;
  revokedAt: string | null;

  loginAt: string;
  lastAccessedAt: string | null;
}
