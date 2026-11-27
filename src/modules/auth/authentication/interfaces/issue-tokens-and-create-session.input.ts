
import { AuthPlatform } from '@prisma/client';
import { EmailPasswordLoginServiceDto } from '../dto/email-password-login.service.dto';

export interface IssueTokensAndCreateSessionInput {
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;

    userRoles: Array<{
      roleId: string;
      isActive: boolean;
      revokedAt: Date | null;

      role: {
        code: string;
        isActive: boolean;
        deletedAt: Date | null;
      };
    }>;
  };

  activeRoleId: string;
  platform: AuthPlatform;
  data: EmailPasswordLoginServiceDto;
}
