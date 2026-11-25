import { Controller, Get } from '@nestjs/common';

import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
} from '@nestjs/terminus';

import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';

import { PrismaService } from '../infrastructure/database/prisma.service';
import { RedisService } from '../infrastructure/redis/redis.service';

import { ResponseMessage } from '../common/decorators/response-message.decorator';

@ApiTags('Health Check')
@Controller({
  path: 'health',
  version: '1',
})
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthIndicator: HealthIndicatorService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Check API liveness' })
  @ApiOkResponse({ description: 'Application is alive.' })
  @ResponseMessage('Application is running')
  checkLiveness() {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Check application readiness' })
  @ApiOkResponse({ description: 'Application dependencies are healthy.' })
  @ApiServiceUnavailableResponse({
    description: 'One or more dependencies are unavailable.',
  })
  @ResponseMessage('Application readiness checked successfully')
  checkReadiness() {
    return this.health.check([
      async () => {
        const indicator = this.healthIndicator.check('database');

        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return indicator.up();
        } catch {
          return indicator.down('Database connection failed');
        }
      },

      async () => {
        const indicator = this.healthIndicator.check('redis');

        try {
          await this.redis.ping();
          return indicator.up();
        } catch {
          return indicator.down('Redis connection failed');
        }
      },
    ]);
  }
}