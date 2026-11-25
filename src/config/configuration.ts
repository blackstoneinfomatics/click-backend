import databaseConfig from './database.config';
import redisConfig from './redis.config';
import stripeConfig from './stripe.config';
import jwtConfig from './jwt.config';

export default () => ({
  app: {
    name: process.env.APP_NAME || 'Click Bike Service',
    environment: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 3000,
  },

  ...databaseConfig(),
  ...redisConfig(),
  ...stripeConfig(),
  ...jwtConfig(),
});