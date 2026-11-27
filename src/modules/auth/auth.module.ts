import { Module } from '@nestjs/common';
import { JwtModule } from './jwt/jwt.module';
import { AuthenticationModule } from './authentication/authentication.module';
import { SessionModule } from './session/session.module';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from './user/user.module';
import { SessionGuard } from './guards/session.guard';

@Module({
  imports: [
    PassportModule.register({
      session: false,
    }),
    JwtModule,
    AuthenticationModule,
    SessionModule,
    UserModule,
  ],
   providers: [
    JwtStrategy,
    JwtAuthGuard,
    SessionGuard
  ],
  exports: [
    JwtAuthGuard,
    SessionGuard,
    SessionModule,
  ],
})
export class AuthModule {}
