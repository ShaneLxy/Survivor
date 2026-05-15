import { IsObject, IsOptional, IsString, Length } from 'class-validator';

export class TapTapLoginDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  openId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  unionId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  nickname?: string;

  @IsOptional()
  @IsString()
  @Length(1, 512)
  avatar?: string;

  @IsOptional()
  @IsObject()
  accessToken?: Record<string, any>;
}
