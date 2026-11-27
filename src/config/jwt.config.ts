
export default () => ({
  jwt: {
    // RSA key configuration
    privateKey: (process.env.JWT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    publicKey: (process.env.JWT_PUBLIC_KEY || '').replace(/\\n/g, '\n'),

    // JWT metadata
    kid: process.env.JWT_KID || 'click-bike-kid-001',
    issuer: process.env.JWT_ISSUER || 'click-bike-auth',
    audience: process.env.JWT_DEFAULT_AUD || 'click-api',

    // Refresh token security
    refreshJtiHashSecret: process.env.REFRESH_JTI_HASH_SECRET,

    // Token expiry (seconds)
    accessTokenExpiresIn: Number(process.env.ACCESS_TTL || 900),
    refreshTokenExpiresIn: Number(process.env.REFRESH_TTL || 2592000),
  },
});
