export interface UserAccountDocument {
    _id: string;
    account: string | null;
    passwordHash: string | null;
    loginType: string;
    sessionVersion?: number | null;
    nickname: string | null;
    wechatOpenId: string | null;
    wechatUnionId: string | null;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
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
    type: 'resource' | 'item';
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
    createdAt: string;
    updatedAt: string;
}
