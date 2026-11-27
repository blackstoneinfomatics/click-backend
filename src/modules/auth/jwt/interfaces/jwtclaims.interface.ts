
import type { JWTPayload } from 'jose';
import { AuthPlatform } from '@/common/types/auth-platform.type';

export type TokenType = 'access' | 'refresh';

export interface BaseClaims {
  name?: string | null;
  email?: string | null;
  phone?: string | null;

  role: string;
  roleId: string;

  sessionId: string;
  platform: AuthPlatform;
  deviceId: string;
}

export interface JwtClaims extends JWTPayload, BaseClaims {
}

export interface JwtVerifyClaims extends JWTPayload, BaseClaims {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  tokenType: TokenType;
}

export interface SignTokenOptions {
  sub: string;
  ttlSec: number;
  audience?: string;
}
