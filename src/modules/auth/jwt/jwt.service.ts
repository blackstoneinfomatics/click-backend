
import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SignJWT,
  importPKCS8,
  importSPKI,
  exportJWK,
  jwtVerify,
} from 'jose';
import { createHmac, randomUUID } from 'crypto';

import {
  JwtClaims,
  JwtVerifyClaims,
  SignTokenOptions,
  TokenType,
} from './interfaces/jwtclaims.interface';

@Injectable()
export class JwtService {
  private readonly logger = new Logger(JwtService.name);
  private readonly alg = 'RS256';

  private readonly privateKeyPem: string;
  private readonly publicKeyPem: string;
  private readonly kid: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly refreshJtiHashSecret: string;

  private privateKeyPromise?: ReturnType<typeof importPKCS8>;
  private publicKeyPromise?: ReturnType<typeof importSPKI>;

  constructor(private readonly configService: ConfigService) {
    this.privateKeyPem = this.configService.getOrThrow<string>(
      'jwt.privateKey',
    );

    this.publicKeyPem = this.configService.getOrThrow<string>(
      'jwt.publicKey',
    );

    this.kid = this.configService.getOrThrow<string>('jwt.kid');
    this.issuer = this.configService.getOrThrow<string>('jwt.issuer');
    this.audience = this.configService.getOrThrow<string>('jwt.audience');

    this.refreshJtiHashSecret =
      this.configService.getOrThrow<string>(
        'jwt.refreshJtiHashSecret',
      );

    if (
      !this.privateKeyPem.includes('BEGIN PRIVATE KEY') ||
      !this.publicKeyPem.includes('BEGIN PUBLIC KEY')
    ) {
      throw new InternalServerErrorException(
        'Invalid JWT RSA key configuration',
      );
    }
  }

  private getPrivateKey() {
    this.privateKeyPromise ??= importPKCS8(
      this.privateKeyPem,
      this.alg,
    );

    return this.privateKeyPromise;
  }

  private getPublicKey() {
    this.publicKeyPromise ??= importSPKI(
      this.publicKeyPem,
      this.alg,
    );

    return this.publicKeyPromise;
  }

  // Generate access or refresh JWT.
  async signToken(
    claims: JwtClaims,
    options: SignTokenOptions,
  ) {
    const privateKey = await this.getPrivateKey();

    const now = Math.floor(Date.now() / 1000);
    const jti = randomUUID();

    const token = await new SignJWT(claims)
      .setProtectedHeader({
        alg: this.alg,
        kid: this.kid,
        typ: 'JWT',
      })
      .setIssuer(this.issuer)
      .setSubject(options.sub)
      .setAudience(this.audience)
      .setIssuedAt(now)
      .setExpirationTime(now + options.ttlSec)
      .setJti(jti)
      .sign(privateKey);

    return {
      jwt: token,
      jti,
      exp: now + options.ttlSec,
    };
  }

  async signAccessToken(
    claims: JwtClaims,
    sub: string,
    audience?: string,
  ) {
    const ttlSec = this.configService.getOrThrow<number>(
      'jwt.accessTokenExpiresIn',
    );

    return this.signToken(
      {
        ...claims,
        tokenType: 'access',
      },
      {
        sub,
        ttlSec,
        audience,
      },
    );
  }

  async signRefreshToken(
    claims: JwtClaims,
    sub: string,
    audience?: string,
  ) {
    const ttlSec = this.configService.getOrThrow<number>(
      'jwt.refreshTokenExpiresIn',
    );

    return this.signToken(
      {
        ...claims,
        tokenType: 'refresh',
      },
      {
        sub,
        ttlSec,
        audience,
      },
    );
  }

  // Hash JTI before storing it.
  hashRefreshJti(jti: string): string {
    return createHmac('sha256', this.refreshJtiHashSecret)
      .update(jti)
      .digest('hex');
  }

  // Hash the complete refresh token.
  hashRefreshToken(token: string): string {
    return createHmac('sha256', this.refreshJtiHashSecret)
      .update(token)
      .digest('hex');
  }

  // Verify access or refresh JWT.
  async verifyToken(
    token: string,
    expectedType: TokenType,
    expectedAudience?: string,
  ): Promise<{
    ok: boolean;
    payload: JwtVerifyClaims | null;
    kid: string;
  }> {
    try {
      const publicKey = await this.getPublicKey();

      const { payload, protectedHeader } = await jwtVerify(
        token,
        publicKey,
        {
          algorithms: [this.alg],
          issuer: this.issuer,
          audience:this.audience,
        },
      );

      if (payload.tokenType !== expectedType) {
        throw new Error('Invalid token type');
      }

      if (
        typeof payload.sub !== 'string' ||
        typeof payload.jti !== 'string' ||
        typeof payload.exp !== 'number' ||
        typeof payload.iat !== 'number' ||
        typeof payload.sessionId !== 'string'
      ) {
        throw new Error('Invalid JWT claims');
      }

      return {
        ok: true,
        payload: payload as unknown as JwtVerifyClaims,
        kid: protectedHeader.kid ?? '',
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown token verification error';

      this.logger.warn(`Token verification failed: ${message}`);

      return {
        ok: false,
        payload: null,
        kid: '',
      };
    }
  }

  async publicJwks() {
    const publicKey = await this.getPublicKey();
    const jwk = await exportJWK(publicKey);

    return {
      keys: [
        {
          ...jwk,
          alg: this.alg,
          kid: this.kid,
          use: 'sig',
          kty: 'RSA',
        },
      ],
    };
  }

  getKid(): string {
    return this.kid;
  }
}
