export const RedisKeys = {
  // Access token JTI hash per session
  accessToken: (sessionId: string) => `auth:access:${sessionId}`,

  // Refresh token JTI hash per session
  refreshToken: (sessionId: string) => `auth:refresh:${sessionId}`,

  // Global logout timestamp per user
  revokedUser: (userId: string) => `auth:revoked:user:${userId}`,

  // All active session IDs for a user
  userSessions: (userId: string) => `auth:user:sessions:${userId}`,

  activeSession: (sessionId: string) => `auth:session:${sessionId}`,

  refreshBlacklist: (hashedJti: string) =>
    `refresh:blacklist:${hashedJti}`,

  // Optional device index
  devices: (userId: string) => `auth:user:${userId}:devices`,

  // OTP keys (for the authentication module)
  otp: (phoneNumber: string) => `auth:otp:${phoneNumber}`,

  otpAttempts: (phoneNumber: string) => `auth:otp:${phoneNumber}:attempts`,

  otpResend: (phoneNumber: string) => `auth:otp:${phoneNumber}:resend`,
};
