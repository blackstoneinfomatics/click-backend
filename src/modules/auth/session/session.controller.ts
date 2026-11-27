
import {
  Controller,
  Get,
  Delete,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

import { SessionService } from '..//session/session.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    sessionId: string;
  };
}

@Controller({
  path: 'auth/sessions',
  version: '1',
})
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
  ) {}

  // GET /api/v1/auth/sessions
  @Get()
  async getMySessions(@Req() req: AuthenticatedRequest) {
    return this.sessionService.getUserSessions(req.user.sub);
  }

  // DELETE /api/v1/auth/sessions/:sessionId
  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    // Prevent the user from revoking another user's session.
    await this.sessionService.revokeSession(
      sessionId,
      req.user.sub,
    );
  }

  // DELETE /api/v1/auth/sessions
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAllSessions(
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.sessionService.revokeAllUserSessions(
      req.user.sub,
    );
  }
}
