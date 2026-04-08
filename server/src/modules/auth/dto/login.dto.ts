import { IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(4, 20)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: '账号格式不正确' })
  account: string;

  @IsString()
  @Length(6, 32)
  password: string;
}
