
export const ROLES = {
  RIDER: 'RIDER',
  DRIVER: 'DRIVER',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];
