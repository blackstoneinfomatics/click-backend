
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { SessionRepository } from './repositories/session.repository';
import { CreateActiveSessionDto } from './dto/create-active-session.dto';
import { ActiveSessionResponseDto } from './dto/active-session-response.dto';
import { CachedActiveSession } from './interfaces/active-session.interface';

import { RedisKeys } from '@/infrastructure/redis/constants/redis-keys';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { RotateSessionTokensDto } from './dto/rotate-session-tokens.dto';

export interface InitializeSessionCacheInput {
  sessionId: string;
  userId: string;
  accessTokenJti: string;
  refreshTokenJti: string;
  accessTtl: number;
  refreshTtl: number;
}

export interface UpdateSessionTokensInput {
  sessionId: string;
  accessTokenJti: string;
  refreshTokenJti: string;
  refreshExpiresAt: Date;
  accessTtl: number;
  refreshTtl: number;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly repository: SessionRepository,
    private readonly redis: RedisService,
  ) {}

  // 1. Create PostgreSQL session.
  async create(data: CreateActiveSessionDto) {
    return this.repository.create(data);
  }

  // 2. Get session by ID.
  async getById(sessionId: string) {
    return this.repository.getById(sessionId);
  }

  // 3. Get active sessions belonging to a user.
  async getUserSessions(
    userId: string,
  ): Promise<ActiveSessionResponseDto[]> {
    return this.repository.findActiveByUserId(userId);
  }

  // 4. Initialize all Redis data after PostgreSQL session creation.
  async initializeSessionCache(
    input: InitializeSessionCacheInput,
  ): Promise<void> {
    const {
      sessionId,
      userId,
      accessTokenJti,
      refreshTokenJti,
      accessTtl,
      refreshTtl,
    } = input;

    if (accessTtl <= 0 || refreshTtl <= 0) {
      throw new InternalServerErrorException(
        'Invalid session cache expiration.',
      );
    }

    const session = await this.getById(sessionId);

    if (
      !session ||
      session.userId !== userId ||
      session.isRevoked ||
      session.deletedAt
    ) {
      throw new Error('Cannot initialize an invalid session.');
    }

    // Cache the persisted session snapshot.
    await this.cacheActiveSession(session);

    // Initialize token indexes and user session index.
    const results = await Promise.allSettled([
      this.redis.set(
        RedisKeys.accessToken(sessionId),
        accessTokenJti,
        accessTtl,
      ),
      this.redis.set(
        RedisKeys.refreshToken(sessionId),
        refreshTokenJti,
        refreshTtl,
      ),
      this.redis.sadd(
        RedisKeys.userSessions(userId),
        sessionId,
      ),
    ]);

    const failed = results.find(
      (result) => result.status === 'rejected',
    );

    if (failed?.status === 'rejected') {
      throw failed.reason;
    }
  }

  // 5. Cache a persisted session snapshot.
  async cacheActiveSession(session: {
    id: string;
    userId: string;
    activeRoleId: string | null;
    deviceId: string;
    platform: any;
    accessTokenJti: string;
    refreshTokenJti: string;
    refreshExpiresAt: Date;
    isRevoked: boolean;
    revokedAt: Date | null;
    loginAt: Date;
    lastAccessedAt: Date | null;
  }): Promise<void> {
    const remainingTtl = Math.floor(
      (session.refreshExpiresAt.getTime() - Date.now()) / 1000,
    );

    if (remainingTtl <= 0) {
      throw new Error('Session has already expired.');
    }

    const cached: CachedActiveSession = {
      id: session.id,
      userId: session.userId,
      activeRoleId: session.activeRoleId,
      deviceId: session.deviceId,
      platform: session.platform,

      accessTokenJti: session.accessTokenJti,
      refreshTokenJti: session.refreshTokenJti,

      refreshExpiresAt: session.refreshExpiresAt.toISOString(),

      isRevoked: session.isRevoked,
      revokedAt: session.revokedAt?.toISOString() ?? null,

      loginAt: session.loginAt.toISOString(),
      lastAccessedAt:
        session.lastAccessedAt?.toISOString() ?? null,
    };

    await this.redis.set(
      RedisKeys.activeSession(session.id),
      JSON.stringify(cached),
      remainingTtl,
    );
  }

  // 6. Retrieve a valid active session.
  async getActiveSession(sessionId: string) {
    const session = await this.repository.getById(sessionId);

    if (
      !session ||
      session.isRevoked ||
      session.deletedAt ||
      session.refreshExpiresAt <= new Date()
    ) {
      return null;
    }

    return session;
  }

  // 7. Update token hashes during refresh-token rotation.
  async updateSessionTokens(
    input: UpdateSessionTokensInput,
  ): Promise<void> {
    const {
      sessionId,
      accessTokenJti,
      refreshTokenJti,
      refreshExpiresAt,
      accessTtl,
      refreshTtl,
    } = input;

    if (accessTtl <= 0 || refreshTtl <= 0) {
      throw new Error('Invalid token expiration.');
    }

    const session = await this.repository.updateTokenHashes({
      sessionId,
      accessTokenJti,
      refreshTokenJti,
      refreshExpiresAt,
    });

    // Refresh the session snapshot and token indexes.
    await this.cacheActiveSession(session);

    const results = await Promise.allSettled([
      this.redis.set(
        RedisKeys.accessToken(sessionId),
        accessTokenJti,
        accessTtl,
      ),
      this.redis.set(
        RedisKeys.refreshToken(sessionId),
        refreshTokenJti,
        refreshTtl,
      ),
    ]);

    const failed = results.find(
      (result) => result.status === 'rejected',
    );

    if (failed?.status === 'rejected') {
      throw failed.reason;
    }
  }

  // 8. Update last accessed timestamp.
  async updateLastAccessedAt(sessionId: string): Promise<void> {
    await this.repository.updateLastAccessedAt(sessionId);
  }

  // 9. Revoke a session internally (e.g. failed login initialization).
  async revoke(sessionId: string): Promise<void> {
    const session = await this.repository.getById(sessionId);

    if (!session) {
      return;
    }

    await this.repository.revoke(sessionId);

    await this.removeSessionFromRedis(sessionId, session.userId);
  }

  // 10. Revoke one session after verifying ownership.
  async revokeSession(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.repository.revoke(
      sessionId,
      userId,
    );

    if (result.count === 0) {
      throw new NotFoundException('Active session not found.');
    }

    await this.removeSessionFromRedis(sessionId, userId);
  }

  // 11. Revoke all sessions belonging to a user.
  async revokeAllUserSessions(userId: string): Promise<void> {
    // Revoke in PostgreSQL first.
    await this.repository.revokeAllByUserId(userId);

    // Get Redis session index.
    let sessionIds: string[] = [];

    try {
      sessionIds = await this.redis.smembers(
        RedisKeys.userSessions(userId),
      );
    } catch (error) {
      this.logger.error(
        'Unable to retrieve Redis session index after revocation',
        error instanceof Error ? error.stack : String(error),
      );

      // DB revocation has already happened.
      return;
    }

    const cleanupResults = await Promise.allSettled([
      ...sessionIds.map((sessionId) =>
        this.removeSessionKeys(sessionId),
      ),
      this.redis.del(RedisKeys.userSessions(userId)),
      this.redis.del(RedisKeys.devices(userId)),
    ]);

    cleanupResults.forEach((result) => {
      if (result.status === 'rejected') {
        this.logger.error(
          'Redis cleanup failed after bulk session revocation',
          result.reason instanceof Error
            ? result.reason.stack
            : String(result.reason),
        );
      }
    });
  }
  async validateRefreshSession(
    sessionId: string,
    userId: string,
    platform: string,
  ) {
    const session = await this.repository.getById(sessionId);

    if (
      !session ||
      session.userId !== userId ||
      session.platform !== platform ||
      session.isRevoked ||
      session.deletedAt ||
      session.refreshExpiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException(
        'Invalid or expired session. Please login again.',
      );
    }

    return session;
  }

  /**
   * Atomically rotate tokens in PostgreSQL.
   * Synchronize Redis only after successful database rotation.
   */
  async rotateTokens(
    sessionId: string,
    userId: string,
    data: RotateSessionTokensDto,
  ): Promise<void> {
    const result = await this.repository.rotateTokens(
      sessionId,
      userId,
      data,
    );

    if (result.count !== 1) {
      throw new UnauthorizedException(
        'Refresh token already used or session is invalid.',
      );
    }

    await this.syncRotatedSession(
      sessionId,
      userId,
      data,
    );
  }

  /**
   * Synchronize rotated tokens with Redis.
   */
  private async syncRotatedSession(
    sessionId: string,
    userId: string,
    data: RotateSessionTokensDto,
  ): Promise<void> {
    try {
      const session = await this.repository.getById(sessionId);

      if (!session) {
        this.logger.error(
          `Rotated session not found: ${sessionId}`,
        );
        return;
      }

      const cachedSession = {
        id: session.id,
        userId: session.userId,
        activeRoleId: session.activeRoleId,
        deviceId: session.deviceId,
        platform: session.platform,

        accessTokenJti: session.accessTokenJti,
        refreshTokenJti: session.refreshTokenJti,

        refreshExpiresAt:
          session.refreshExpiresAt.toISOString(),

        isRevoked: session.isRevoked,

        revokedAt:
          session.revokedAt?.toISOString() ?? null,

        loginAt:
          session.loginAt.toISOString(),

        lastAccessedAt:
          session.lastAccessedAt?.toISOString() ?? null,
      };

      await Promise.all([
        this.redis.set(
          RedisKeys.activeSession(sessionId),
          JSON.stringify(cachedSession),
          data.refreshTtl,
        ),

        this.redis.set(
          RedisKeys.accessToken(sessionId),
          data.accessTokenJti,
          data.accessTtl,
        ),

        this.redis.set(
          RedisKeys.refreshToken(sessionId),
          data.refreshTokenJti,
          data.refreshTtl,
        ),

        this.redis.sadd(
          RedisKeys.userSessions(userId),
          sessionId,
        ),
      ]);

    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown Redis error';

      this.logger.error(
        `Session Redis synchronization failed: ${message}`,
      );

      // Database rotation has already succeeded.
      // Never roll back PostgreSQL because Redis failed.
      // Authentication must continue validating against PostgreSQL.
    }
  }


  // 12. Remove one session from Redis indexes.
  private async removeSessionFromRedis(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const results = await Promise.allSettled([
      this.removeSessionKeys(sessionId),
      this.redis.srem(
        RedisKeys.userSessions(userId),
        sessionId,
      ),
    ]);

    results.forEach((result) => {
      if (result.status === 'rejected') {
        this.logger.error(
          'Redis cleanup failed after session revocation',
          result.reason instanceof Error
            ? result.reason.stack
            : String(result.reason),
        );
      }
    });
  }

  // 13. Remove all Redis keys belonging to one session.
  private async removeSessionKeys(
    sessionId: string,
  ): Promise<void> {
    const results = await Promise.allSettled([
      this.redis.del(RedisKeys.activeSession(sessionId)),
      this.redis.del(RedisKeys.accessToken(sessionId)),
      this.redis.del(RedisKeys.refreshToken(sessionId)),
    ]);

    results.forEach((result) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Redis key cleanup failed for session ${sessionId}`,
          result.reason instanceof Error
            ? result.reason.stack
            : String(result.reason),
        );
      }
    });
  }
}
