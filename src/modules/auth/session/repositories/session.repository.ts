
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CreateActiveSessionDto } from '../dto/create-active-session.dto';
import { RotateSessionTokensDto } from '../dto/rotate-session-tokens.dto';

interface UpdateTokenHashesInput {
  sessionId: string;
  accessTokenJti: string;
  refreshTokenJti: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class SessionRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // 1. Create session.
  async create(data: CreateActiveSessionDto) {
    return this.prisma.activeSession.create({
      data,
    });
  }

  // 2. Find session by ID.
  async getById(sessionId: string) {
    return this.prisma.activeSession.findUnique({
      where: {
        id: sessionId,
      },
    });
  }

  // 3. Find all active sessions for a user.
  async findActiveByUserId(userId: string) {
    return this.prisma.activeSession.findMany({
      where: {
        userId,
        isRevoked: false,
        deletedAt: null,
        refreshExpiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        lastAccessedAt: 'desc',
      },
      select: {
        id: true,
        deviceId: true,
        platform: true,
        ipAddress: true,
        userAgent: true,
        country: true,
        appVersion: true,
        loginAt: true,
        lastAccessedAt: true,
        refreshExpiresAt: true,
        isRevoked: true,
      },
    });
  }

  // 4. Revoke one session.
  // userId is optional for trusted internal operations.
  async revoke(sessionId: string, userId?: string) {
    return this.prisma.activeSession.updateMany({
      where: {
        id: sessionId,
        ...(userId ? { userId } : {}),
        isRevoked: false,
        deletedAt: null,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        logoutAt: new Date(),
      },
    });
  }

  // 5. Revoke every active session for a user.
  async revokeAllByUserId(userId: string) {
    const now = new Date();

    return this.prisma.activeSession.updateMany({
      where: {
        userId,
        isRevoked: false,
        deletedAt: null,
      },
      data: {
        isRevoked: true,
        revokedAt: now,
        logoutAt: now,
      },
    });
  }

  // 6. Update token hashes during refresh rotation.
  async updateTokenHashes(input: UpdateTokenHashesInput) {
    const {
      sessionId,
      accessTokenJti,
      refreshTokenJti,
      refreshExpiresAt,
    } = input;

    return this.prisma.activeSession.update({
      where: {
        id: sessionId,
      },
      data: {
        accessTokenJti,
        refreshTokenJti,
        refreshExpiresAt,
      },
    });
  }

  // 7. Update last activity.
  async updateLastAccessedAt(sessionId: string) {
    return this.prisma.activeSession.updateMany({
      where: {
        id: sessionId,
        isRevoked: false,
        deletedAt: null,
      },
      data: {
        lastAccessedAt: new Date(),
      },
    });
  }

    async rotateTokens(
    sessionId: string,
    userId: string,
    data: RotateSessionTokensDto,
  ) {
    return this.prisma.activeSession.updateMany({
      where: {
        id: sessionId,
        userId,

        refreshTokenJti: data.expectedRefreshTokenJti,
        refreshTokenHash: data.expectedRefreshTokenHash,

        isRevoked: false,
        deletedAt: null,

        refreshExpiresAt: {
          gt: new Date(),
        },
      },

      data: {
        accessTokenJti: data.accessTokenJti,
        refreshTokenJti: data.refreshTokenJti,
        refreshTokenHash: data.refreshTokenHash,

        refreshExpiresAt: data.refreshExpiresAt,

        lastAccessedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}
