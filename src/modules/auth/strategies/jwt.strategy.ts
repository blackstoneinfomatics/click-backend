
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { JwtVerifyClaims } from '../jwt/interfaces/jwtclaims.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const publicKey = configService.getOrThrow<string>(
      'jwt.publicKey',
    );

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request) => request?.cookies?.accessToken ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
      issuer: configService.getOrThrow<string>('jwt.issuer'),
      audience: configService.getOrThrow<string>('jwt.audience'),
    });
  }

  async validate(
    payload: JwtVerifyClaims,
  ): Promise<JwtVerifyClaims> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid access token');
    }

    if (!payload.sessionId) {
      throw new UnauthorizedException('Invalid session');
    }

    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    return payload;
  }
}
