import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsUUID } from 'class-validator';

export class TestLoginDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsBoolean()
  allDevices!: boolean;
}

export class AccessTokenDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ description: 'Seconds until the access token expires' })
  expiresIn!: number;
}
