import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(4, 20)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: '账号只能包含字母、数字和下划线' })
  account: string;

  @IsString()
  @Length(6, 32)
  password: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  nickname?: string;
}
