import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AuthProviderType } from '@prisma/client';

@Injectable()
export class AuthProviderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProvider(
    provider: AuthProviderType,
    providerUserId: string,
  ) {
    return this.prisma.authProvider.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId,
        },
      },
      include: {
        user: {
          include: {
            authProviders: true,
            userRoles: {
              where: {
                isActive: true,
                revokedAt: null,
              },
              include: {
                role: true,
              },
            },
          },
        },
      },
    });
  }
}