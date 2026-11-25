import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from 'src/infrastructure/database/prisma.module';
import { RedisModule } from 'src/infrastructure/redis/redis.module';

@Module({
  imports: [
    TerminusModule,
    PrismaModule,
    RedisModule,
  ],
  controllers: [HealthController]
})
export class HealthModule {}
