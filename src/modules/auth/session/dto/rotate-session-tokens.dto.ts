export class RotateSessionTokensDto {
  expectedRefreshTokenJti!: string;
  expectedRefreshTokenHash!: string;

  accessTokenJti!: string;
  refreshTokenJti!: string;
  refreshTokenHash!: string;

  refreshExpiresAt!: Date;

  accessTtl!: number;
  refreshTtl!: number;
}