export interface UserAccount {
  _id: string;
  account: string | null;
  passwordHash: string | null;
  loginType: string;
  nickname: string | null;
  wechatOpenId: string | null;
  wechatUnionId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
