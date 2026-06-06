export interface UserAccountBanStatus {
  bannedAt: string;
  reason: string;
  details?: Record<string, any> | null;
}

export interface UserAccountDocument {
  _id: string;
  account: string | null;
  passwordHash: string | null;
  loginType: string;
  sessionVersion?: number | null;
  nickname: string | null;
  wechatOpenId: string | null;
  wechatUnionId: string | null;
  taptapOpenId?: string | null;
  taptapUnionId?: string | null;
  taptapAvatar?: string | null;
  lastLoginAt: string | null;
  banStatus?: UserAccountBanStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogDocument {
  _id: string;
  accountId: string;
  type: 'save_anomaly' | 'save_banned' | 'https_violation' | 'login_blocked';
  severity: 'info' | 'warning' | 'critical';
  field?: string;
  before?: any;
  after?: any;
  delta?: number;
  threshold?: number;
  ip?: string | null;
  userAgent?: string | null;
  message?: string;
  details?: Record<string, any> | null;
  // 必须是 BSON Date 类型（不是 ISO 字符串）才能让 MongoDB TTL 索引生效
  createdAt: Date;
}

export interface PlayerSaveDocument {
  _id: string;
  accountId: string;
  version: string;
  saveData: Record<string, any> | null;
  lastSaveTime: number;
  createdAt: string;
  updatedAt: string;
}

export interface MailAttachment {
  type: 'resource' | 'item' | 'fragment';
  id: string;
  amount: number;
}

export interface PlayerMailDocument {
  _id: string;
  accountId: string;
  title: string | null;
  body: string | null;
  sender: string | null;
  attachments: MailAttachment[] | null;
  expireAt: string | null;
  readAt: string | null;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CdkeyDocument {
  _id: string;
  code: string;
  title: string | null;
  rewards: MailAttachment[] | null;
  used: boolean;
  usedByAccountId: string | null;
  usedAt: string | null;
  expireAt: string | null;
  enabled?: boolean | null;
  batchId?: string | null;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GameOperationAnnouncement {
  id: string;
  title: string;
  content: string;
  order: number;
}

export interface GameOperationConfigDocument {
  _id: string;
  gameStatus: 'normal' | 'maintenance';
  announcements: GameOperationAnnouncement[];
  createdAt: string;
  updatedAt: string;
}
