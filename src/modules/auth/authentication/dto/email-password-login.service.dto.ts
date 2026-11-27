
import { AuthPlatform} from '../../enum/authPlatform.enum';
import { DevicePlatform } from '../../enum/devicePlatform.enum';

export class EmailPasswordLoginServiceDto {
  email!: string;

  password!: string;

  authPlatform!: AuthPlatform;

  devicePlatform!: DevicePlatform;

  appVersion?: string;

  deviceId?: string;

  country?: string;

  userAgent?: string;

  ipAddress?: string;
}
