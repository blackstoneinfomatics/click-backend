
import 'dotenv/config';

import {
  PrismaClient,
  AuthProviderType,
  UserStatus,
} from '@prisma/client';

import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ROLES = [
  {
    name: 'Rider',
    code: 'RIDER',
    description: 'Customer who books bike rides',
  },
  {
    name: 'Driver',
    code: 'DRIVER',
    description: 'Driver who accepts and completes rides',
  },
  {
    name: 'Super Admin',
    code: 'SUPER_ADMIN',
    description: 'Platform administrator',
  },
] as const;

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const firstName = process.env.SUPER_ADMIN_FIRST_NAME || 'Super Admin';

  if (!email || !password) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required',
    );
  }

  if (password.length < 12) {
    throw new Error('Super Admin password must be at least 12 characters');
  }

  await prisma.$transaction(async (tx) => {
    // 1. Create all system roles
    const roleRecords = await Promise.all(
      ROLES.map((role) =>
        tx.role.upsert({
          where: { code: role.code },
          update: {},
          create: {
            ...role,
            isSystem: true,
            isActive: true,
          },
        }),
      ),
    );

    const superAdminRole = roleRecords.find(
      (role) => role.code === 'SUPER_ADMIN',
    );

    if (!superAdminRole || !superAdminRole.isActive || superAdminRole.deletedAt) {
      throw new Error('SUPER_ADMIN role is inactive or deleted');
    }

    // 2. Create the first Super Admin user
    const user = await tx.user.upsert({
      where: { email },
      update: {},
      create: {
        firstName,
        email,
        emailVerified: true,
        status: UserStatus.ACTIVE,
      },
    });

    if (user.status !== UserStatus.ACTIVE || user.deletedAt) {
      throw new Error('Super Admin user is not active');
    }

    // 3. Create email/password authentication provider
    const existingProvider = await tx.authProvider.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProviderType.EMAIL_PASSWORD,
          providerUserId: email,
        },
      },
    });

    if (existingProvider && existingProvider.userId !== user.id) {
      throw new Error('Email provider is linked to another user');
    }

    if (!existingProvider) {
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
      });

      await tx.authProvider.create({
        data: {
          userId: user.id,
          provider: AuthProviderType.EMAIL_PASSWORD,
          providerUserId: email,
          passwordHash,
          isPrimary: true,
        },
      });
    }

    // 4. Assign Super Admin role
    const existingAssignment = await tx.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: superAdminRole.id,
        },
      },
    });

    if (existingAssignment?.isActive === false) {
      throw new Error(
        'Super Admin role assignment was revoked. Review it manually before reactivating.',
      );
    }

    if (!existingAssignment) {
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: superAdminRole.id,
          isActive: true,
        },
      });
    }

    console.log('Initial Super Admin seeded successfully:', user.id);
    console.log('Roles created or verified:', roleRecords.length);
  }, {
    maxWait: 10000,
    timeout: 20000,
  },);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
