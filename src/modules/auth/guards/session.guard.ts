import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { RedisKeys } from '../../../infrastructure/redis/constants/redis-keys';
import { SessionService } from '../session/session.service';
import { hashJti } from '../../../common/utils/hash-jti';

import { JwtVerifyClaims } from '../jwt/interfaces/jwtclaims.interface';
import { CachedActiveSession } from '../session/interfaces/active-session.interface';

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly logger = new Logger(SessionGuard.name);

  constructor(
    private readonly redis: RedisService,
    private readonly sessionService: SessionService,
    private readonly reflector: Reflector,
  ) {}

 
async canActivate(context: ExecutionContext): Promise<boolean> {
  const isPublic = this.reflector.getAllAndOverride<boolean>(
    IS_PUBLIC_KEY,
    [context.getHandler(), context.getClass()],
  );

  if (isPublic) return true;

  try {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtVerifyClaims;
    if (
      !user?.sub ||
      !user.sessionId ||
      !user.jti ||
      user.iat === undefined ||
      user.exp === undefined
    ) {
      throw new UnauthorizedException('Invalid authentication claims.');
    }

    const now = Math.floor(Date.now() / 1000);

    if (user.exp <= now) {
      throw new UnauthorizedException('Access token expired.');
    }

    // 1. Global logout validation.
    const revokedAt = await this.redis.get(
      RedisKeys.revokedUser(user.sub),
    );

    if (revokedAt && user.iat < Number(revokedAt)) {
      throw new UnauthorizedException('Token globally revoked.');
    }

    // 2. Hash incoming JTI.
    const incomingHash = hashJti(user.jti);

    // 3. Check Redis session and token cache.
    const [cachedHash, cachedSession] = await Promise.all([
      this.redis.get(RedisKeys.accessToken(user.sessionId)),
      this.redis.get(RedisKeys.activeSession(user.sessionId)),
    ]);

    if (cachedHash && typeof cachedSession === 'string') {
      const session = JSON.parse(cachedSession) as CachedActiveSession;

      if (
        cachedHash === incomingHash &&
        session.isRevoked === false &&
        session.userId === user.sub &&
        session.id === user.sessionId &&
        session.platform === user.platform
      ) {
        return true;
      }

      if (cachedHash !== incomingHash) {
        throw new UnauthorizedException('Access token revoked.');
      }
    }

    // 4. PostgreSQL fallback.
    const session = await this.sessionService.getById(user.sessionId);

    if (
      !session ||
      session.deletedAt ||
      session.isRevoked ||
      session.userId !== user.sub ||
      session.platform !== user.platform
    ) {
      throw new UnauthorizedException('Invalid or revoked session.');
    }

    if (session.refreshExpiresAt <= new Date()) {
      throw new UnauthorizedException('Session expired.');
    }

    if (session.accessTokenJti !== incomingHash) {
      throw new UnauthorizedException('Invalid access token.');
    }

    // 5. Restore Redis cache.
    const remainingTtl = user.exp - now;

    if (remainingTtl > 0) {
      await this.redis.set(
        RedisKeys.accessToken(user.sessionId),
        incomingHash,
        remainingTtl,
      );

      await this.sessionService.cacheActiveSession(session);
    }

    return true;
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      throw error;
    }

    this.logger.error(
      'Session validation failed',
      error instanceof Error ? error.stack : String(error),
    );

    throw new UnauthorizedException('Session validation failed.');
  }
}

}
