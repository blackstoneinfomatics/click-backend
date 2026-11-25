
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisService.name);

  private client!: Redis;

  constructor(
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('redis.url');

    const options = {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,

      retryStrategy: (retries: number) => {
        const delay = Math.min(retries * 200, 2000);

        this.logger.warn(
          `Redis reconnect attempt #${retries}. Retrying in ${delay}ms`,
        );

        return delay;
      },
    };

    this.client = redisUrl
      ? new Redis(redisUrl, options)
      : new Redis({
          ...options,
          host: this.configService.get<string>('redis.host'),
          port: this.configService.get<number>('redis.port'),
          username:
            this.configService.get<string>('redis.username') || undefined,
          password:
            this.configService.get<string>('redis.password') || undefined,
        });

    this.client.on('connect', () => {
      this.logger.log('Redis connection established');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis client is ready');
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.client.status !== 'end') {
      await this.client.quit();
      this.logger.log('Redis connection closed gracefully');
    }
  }

  getClient(): Redis {
    return this.client;
  }

  // ---------------------------
  // Connection Health
  // ---------------------------

  async ping(): Promise<string> {
    return this.client.ping();
  }

  // ---------------------------
  // Key-Value Operations
  // ---------------------------

  async set(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    const serialized =
      typeof value === 'string'
        ? value
        : JSON.stringify(value);

    if (serialized === undefined) {
      throw new Error(`Cannot serialize Redis value for key: ${key}`);
    }

    if (ttlSeconds !== undefined) {
      if (ttlSeconds <= 0) {
        throw new Error('Redis TTL must be greater than zero');
      }

      await this.client.set(key, serialized, 'EX', ttlSeconds);
      return;
    }

    await this.client.set(key, serialized);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.client.get(key);

    if (value === null) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) > 0;
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return (await this.client.expire(key, ttlSeconds)) === 1;
  }

  // ---------------------------
  // Set Operations
  // ---------------------------

  async sadd(key: string, value: string): Promise<number> {
    return this.client.sadd(key, value);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async srem(key: string, value: string): Promise<number> {
    return this.client.srem(key, value);
  }

  // ---------------------------
  // Key Scanning
  // ---------------------------

  async scan(pattern: string): Promise<string[]> {
    const keys: string[] = [];

    for await (const key of this.client.scanStream({
      match: pattern,
      count: 100,
    })) {
      keys.push(key);
    }

    return keys;
  }

  // ---------------------------
  // Socket Mapping Helpers
  // ---------------------------

  async addSocket(
    key: string,
    socketId: string,
  ): Promise<number> {
    return this.sadd(key, socketId);
  }

  async removeSocket(
    key: string,
    socketId: string,
  ): Promise<number> {
    return this.srem(key, socketId);
  }

  async getSockets(key: string): Promise<string[]> {
    return this.smembers(key);
  }

  async clearSockets(key: string): Promise<number> {
    return this.del(key);
  }
}
