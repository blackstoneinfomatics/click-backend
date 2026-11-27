import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthPlatform, AuthProviderType, UserStatus } from '@prisma/client';

import * as argon2 from 'argon2';
import { PLATFORM_ROLE_MAP } from '../constants/platform-role.map';
import { AuthProviderRepository } from './repositories/auth-provider.repository';
import { EmailPasswordLoginServiceDto } from './dto/email-password-login.service.dto';
import { IssueTokensAndCreateSessionResponseDto } from './dto/issue-tokens-and-create-session-response.dto';
import { RedisKeys } from '@/infrastructure/redis/constants/redis-keys';
import { randomUUID } from 'crypto';
import { JwtClaims } from '../jwt/interfaces/jwtclaims.interface';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { JwtService } from '../jwt/jwt.service';
import { SessionService } from '../session/session.service';
import { CreateActiveSessionDto } from '../session/dto/create-active-session.dto';
import { IssueTokensAndCreateSessionInput } from './interfaces/issue-tokens-and-create-session.input';
import { GetTokenDto } from './dto/get-token.service.dto';

// Import your actual session/token service types and dependencies.

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(
    private readonly authProviderRepository: AuthProviderRepository,
    private readonly jwtService: JwtService,
    private readonly session: SessionService,
    private readonly redis: RedisService,
  ) {}

  async emailPasswordLogin(
    data: EmailPasswordLoginServiceDto,
  ): Promise<IssueTokensAndCreateSessionResponseDto> {
    try {
      // 1. Validate input.
      if (!data.email || !data.password) {
        throw new BadRequestException('Email and password are required.');
      }

      // 2. Validate application platform.
      const requiredRole = PLATFORM_ROLE_MAP[data.authPlatform];

      if (!requiredRole) {
        throw new BadRequestException('Invalid application platform.');
      }

      // 3. Find authentication provider.
      const authProvider = await this.authProviderRepository.findByProvider(
        AuthProviderType.EMAIL_PASSWORD,
        data.email.trim().toLowerCase(),
      );

      if (!authProvider?.passwordHash || !authProvider.user) {
        throw new UnauthorizedException('Invalid email or password.');
      }

      const user = authProvider.user;

      // 4. Validate user status.
      if (user.status !== UserStatus.ACTIVE || user.deletedAt) {
        throw new ForbiddenException('User account is inactive.');
      }

      // 5. Verify password.
      const isPasswordValid = await argon2.verify(
        authProvider.passwordHash,
        data.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password.');
      }

      // 6. Validate application role.
      const activeRole = user.userRoles.find(
        (userRole) =>
          userRole.role.code === requiredRole &&
          userRole.isActive &&
          !userRole.revokedAt &&
          userRole.role.isActive &&
          !userRole.role.deletedAt,
      );

      if (!activeRole) {
        throw new ForbiddenException(
          'Access not assigned for this application.',
        );
      }

      // 7. Create session and issue tokens.
      return await this.issueTokensAndCreateSession({
        user,
        activeRoleId: activeRole.roleId,
        platform: data.authPlatform,
        data,
      });
    } catch (error) {
      this.logger.error(
        'Email and password login failed',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Unable to login.');
    }
  }

  async refreshToken(
    body: GetTokenDto,
  ): Promise<IssueTokensAndCreateSessionResponseDto> {
    // 1. Verify refresh token.
    const verifyResp = await this.jwtService.verifyToken(
      body.refreshToken,
      'refresh',
      body.authPlatform,
    );

    if (!verifyResp.ok || !verifyResp.payload) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const payload = verifyResp.payload;

    const userId = payload.sub;
    const sessionId = payload.sessionId;
    const oldRefreshJti = payload.jti;
    const deviceId = payload.deviceId;
    const platform = payload.platform;

    if (
      !userId ||
      !sessionId ||
      !oldRefreshJti ||
      !deviceId ||
      platform !== body.authPlatform
    ) {
      throw new UnauthorizedException('Invalid refresh token claims.');
    }

    // 2. Validate PostgreSQL session.
    const session = await this.session.validateRefreshSession(
      sessionId,
      userId,
      body.authPlatform,
    );

    // 3. Validate token hashes against PostgreSQL.
    const incomingJtiHash = this.jwtService.hashRefreshJti(oldRefreshJti);

    const incomingTokenHash = this.jwtService.hashRefreshToken(
      body.refreshToken,
    );

    if (
      session.refreshTokenJti !== incomingJtiHash ||
      session.refreshTokenHash !== incomingTokenHash
    ) {
      throw new UnauthorizedException(
        'Refresh token is invalid or has already been used.',
      );
    }

    // 4. Create replacement token claims.
    const claims: JwtClaims = {
      name: payload.name,
      email: payload.email,
      roleId: payload.roleId,
      role: payload.role,
      sessionId,
      deviceId,
      platform,
    };

    // 5. Generate both replacement tokens.
    const [access, refresh] = await Promise.all([
      this.jwtService.signAccessToken(claims, userId, platform),
      this.jwtService.signRefreshToken(claims, userId, platform),
    ]);

    if (!access.jwt || !refresh.jwt) {
      throw new InternalServerErrorException(
        'Failed to generate replacement tokens.',
      );
    }

    // 6. Calculate TTLs.
    const now = Math.floor(Date.now() / 1000);

    const accessTtl = access.exp - now;
    const refreshTtl = refresh.exp - now;

    if (accessTtl <= 0 || refreshTtl <= 0) {
      throw new InternalServerErrorException('Invalid token expiration.');
    }

    // 7. Hash new token identifiers.
    const newAccessJtiHash = this.jwtService.hashRefreshJti(access.jti);

    const newRefreshJtiHash = this.jwtService.hashRefreshJti(refresh.jti);

    const newRefreshTokenHash = this.jwtService.hashRefreshToken(refresh.jwt);

    // 8. Atomically rotate tokens in PostgreSQL.
    await this.session.rotateTokens(sessionId, userId, {
      expectedRefreshTokenJti: incomingJtiHash,
      expectedRefreshTokenHash: incomingTokenHash,

      accessTokenJti: newAccessJtiHash,
      refreshTokenJti: newRefreshJtiHash,
      refreshTokenHash: newRefreshTokenHash,

      refreshExpiresAt: new Date(refresh.exp * 1000),

      accessTtl,
      refreshTtl,
    });

    // 9. Return replacement tokens.
    return {
      accessToken: access.jwt,
      refreshToken: refresh.jwt,
      accessExp: access.exp,
      refreshExp: refresh.exp,
    };
  }

  async issueTokensAndCreateSession(
    input: IssueTokensAndCreateSessionInput,
  ): Promise<IssueTokensAndCreateSessionResponseDto> {
    const { user, activeRoleId, platform, data } = input;

    const sessionId = randomUUID();
    const userId = user.id;
    const deviceId = data.deviceId ?? randomUUID();

    // 1. Validate selected role.
    const activeRole = user.userRoles.find(
      (item) =>
        item.roleId === activeRoleId &&
        item.isActive &&
        !item.revokedAt &&
        item.role.isActive &&
        !item.role.deletedAt,
    );

    if (!activeRole) {
      throw new ForbiddenException('Invalid active role.');
    }

    // 2. Build session-specific claims.
    const claims: JwtClaims = {
      name: user.displayName,
      email: user.email,
      phone: user.phoneNumber,
      role: activeRole.role.code,
      roleId: activeRole.roleId,
      sessionId,
      platform,
      deviceId,
    };

    // 3. Generate tokens.
    const [access, refresh] = await Promise.all([
      this.jwtService.signAccessToken(claims, userId, platform),
      this.jwtService.signRefreshToken(claims, userId, platform),
    ]);

    // 4. Calculate remaining token TTL.
    const now = Math.floor(Date.now() / 1000);
    const accessTtl = access.exp - now;
    const refreshTtl = refresh.exp - now;

    if (accessTtl <= 0 || refreshTtl <= 0) {
      throw new InternalServerErrorException('Invalid token expiration.');
    }

    // 5. Hash token identifiers.
    const hashedAccessJti = this.jwtService.hashRefreshJti(access.jti);
    const hashedRefreshJti = this.jwtService.hashRefreshJti(refresh.jti);
    const refreshTokenHash = this.jwtService.hashRefreshToken(refresh.jwt);

    // 6. Prepare PostgreSQL session.
    const sessionData: CreateActiveSessionDto = {
      id: sessionId,
      userId,
      activeRoleId,
      deviceId,
      platform,

      accessTokenJti: hashedAccessJti,
      refreshTokenJti: hashedRefreshJti,
      refreshTokenHash,

      refreshExpiresAt: new Date(refresh.exp * 1000),

      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      appVersion: data.appVersion ?? null,
      country: data.country ?? null,

      isRevoked: false,
    };

    // 7. PostgreSQL is the source of truth.
    await this.session.create(sessionData);

    try {
      // 8. Initialize all Redis session data through SessionService.
      await this.session.initializeSessionCache({
        sessionId,
        userId,
        accessTokenJti: hashedAccessJti,
        refreshTokenJti: hashedRefreshJti,
        accessTtl,
        refreshTtl,
      });
    } catch (error) {
      this.logger.error(
        `Session initialization failed for ${sessionId}`,
        error instanceof Error ? error.stack : String(error),
      );

      // Revoke the PostgreSQL session and clean up Redis.
      try {
        await this.session.revoke(sessionId);
      } catch (revokeError) {
        this.logger.error(
          `Failed to revoke session ${sessionId}`,
          revokeError instanceof Error
            ? revokeError.stack
            : String(revokeError),
        );
      }

      throw new InternalServerErrorException(
        'Unable to initialize user session.',
      );
    }

    this.logger.debug(
      `Active session created for user ${userId}, session ${sessionId}`,
    );

    return {
      accessToken: access.jwt,
      refreshToken: refresh.jwt,
      accessExp: access.exp,
      refreshExp: refresh.exp,
    };
  }
  async logout(userId: string, sessionId: string): Promise<void> {
    await this.session.revokeSession(sessionId, userId);
  }
  async logoutAll(userId: string): Promise<void> {
    await this.session.revokeAllUserSessions(userId);
  }
}
