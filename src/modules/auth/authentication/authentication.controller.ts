import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthenticationService } from './authentication.service';
import { Public } from '../../../common/decorators/public.decorator';
import type { Request, Response } from 'express';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { EmailPasswordLoginRequestDto } from './dto/email-password-login-request.dto';
import { EmailPasswordLoginServiceDto } from './dto/email-password-login.service.dto';
import { RefreshTokenRequestDto } from './dto/refresh-token-request.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtVerifyClaims } from '../jwt/interfaces/jwtclaims.interface';

@ApiTags('Authentication')
@Controller({
  path: 'authentication',
  version: '1',
})
export class AuthenticationController {
  private readonly logger = new Logger(AuthenticationController.name);
  constructor(private readonly authService: AuthenticationService) {}

  @Public()
  @Post('email-password-login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Login successful.')
  async emailPasswordLogin(
    @Body() body: EmailPasswordLoginRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data: EmailPasswordLoginServiceDto = {
      ...body,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? undefined,
    };

    const tokens = await this.authService.emailPasswordLogin(data);

    const now = Math.floor(Date.now() / 1000);

    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: Math.max(0, tokens.accessExp - now) * 1000,
      path: '/',
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: Math.max(0, tokens.refreshExp - now) * 1000,
      path: '/',
    });

    return null;
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Token refreshed successfully.')
  async refresh(
    @Body() body: RefreshTokenRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    const tokens = await this.authService.refreshToken({
      refreshToken,
      authPlatform: body.authPlatform,
    });

    const now = Math.floor(Date.now() / 1000);

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: Math.max(tokens.accessExp - now, 0) * 1000,
      path: '/',
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: Math.max(tokens.refreshExp - now, 0) * 1000,
      path: '/',
    });

    return null;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Logged out successfully.')
  async logout(
    @CurrentUser() user: JwtVerifyClaims,
    @Res({ passthrough: true }) res: Response,
  ) {

    await this.authService.logout(user.sub, user.sessionId);

    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });

    return null;
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Logged out from all devices successfully.')
  async logoutAll(
    @CurrentUser() user: JwtVerifyClaims,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAll(user.sub);

    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });

    return null;
  }
}
