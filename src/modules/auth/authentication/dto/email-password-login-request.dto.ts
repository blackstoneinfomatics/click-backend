
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

import { DevicePlatform } from '../../enum/devicePlatform.enum';
import { AuthPlatform as AuthPlatFormEnum } from '../../enum/authPlatform.enum';

export class EmailPasswordLoginRequestDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Invalid email address.' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 128, {
    message: 'Password must be between 8 and 128 characters.',
  })
  password!: string;

  @IsEnum(AuthPlatFormEnum, {
    message: 'Invalid application platform.',
  })
  authPlatform!: AuthPlatFormEnum;

  @IsEnum(DevicePlatform, {
    message: 'Invalid device platform.',
  })
  devicePlatform!: DevicePlatform;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Invalid app version format.',
  })
  appVersion?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  deviceId?: string;
}
