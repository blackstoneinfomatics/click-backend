import { AuthPlatform } from '@/common/types/auth-platform.type';
import { ROLES } from '@/common/constants/roles.constants';

export const PLATFORM_ROLE_MAP: Record<AuthPlatform, string> = {
  RIDER_APP: ROLES.RIDER,
  DRIVER_APP: ROLES.DRIVER,
  SUPER_ADMIN_WEB: ROLES.SUPER_ADMIN,
};