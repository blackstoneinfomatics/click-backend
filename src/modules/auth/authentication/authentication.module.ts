import { Module } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { AuthenticationController } from './authentication.controller';
import { AuthProviderRepository } from './repositories/auth-provider.repository';
import { JwtModule } from '../jwt/jwt.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [JwtModule,SessionModule],
  providers: [AuthenticationService,AuthProviderRepository],
  controllers: [AuthenticationController],
  exports: [AuthenticationService],
})
export class AuthenticationModule {}
