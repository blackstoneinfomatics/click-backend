-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuthProviderType" AS ENUM ('PHONE_OTP', 'EMAIL_PASSWORD', 'GOOGLE', 'APPLE');

-- CreateEnum
CREATE TYPE "AuthPlatform" AS ENUM ('RIDER_APP', 'DRIVER_APP', 'SUPER_ADMIN_WEB');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "displayName" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "avatarUrl" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_providers" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "AuthProviderType" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "auth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "activeRoleId" UUID,
    "deviceId" TEXT NOT NULL,
    "accessTokenJti" TEXT NOT NULL,
    "refreshTokenJti" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMP(3),
    "logoutAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "country" TEXT,
    "appVersion" TEXT,
    "platform" "AuthPlatform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "active_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "roles_isActive_idx" ON "roles"("isActive");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE INDEX "auth_providers_userId_idx" ON "auth_providers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_providers_provider_providerUserId_key" ON "auth_providers"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "active_sessions_accessTokenJti_key" ON "active_sessions"("accessTokenJti");

-- CreateIndex
CREATE UNIQUE INDEX "active_sessions_refreshTokenJti_key" ON "active_sessions"("refreshTokenJti");

-- CreateIndex
CREATE INDEX "active_sessions_userId_isRevoked_idx" ON "active_sessions"("userId", "isRevoked");

-- CreateIndex
CREATE INDEX "active_sessions_deviceId_idx" ON "active_sessions"("deviceId");

-- CreateIndex
CREATE INDEX "active_sessions_refreshExpiresAt_idx" ON "active_sessions"("refreshExpiresAt");

-- CreateIndex
CREATE INDEX "active_sessions_loginAt_idx" ON "active_sessions"("loginAt");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_providers" ADD CONSTRAINT "auth_providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_activeRoleId_fkey" FOREIGN KEY ("activeRoleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
