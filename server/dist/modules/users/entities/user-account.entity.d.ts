import { PlayerSave } from '../../save/entities/player-save.entity';
export declare class UserAccount {
    id: number;
    account: string | null;
    passwordHash: string | null;
    loginType: string;
    nickname: string | null;
    wechatOpenId: string | null;
    wechatUnionId: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    playerSave: PlayerSave;
}
